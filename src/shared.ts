// Helpers shared by the MyST micromark and mdast extensions
import type { CompileContext, Token } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { asciiDigit, markdownLineEnding, markdownSpace } from 'micromark-util-character';
import { codes, constants, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, State, Token as MicromarkToken, TokenizeContext, TokenType } from 'micromark-util-types';

/** A test for characters that match `re`, skipping micromark's negative codes for tabs and line endings */
export const charClass = (re: RegExp) => (code: Code) => code !== null && code > 0 && re.test(String.fromCharCode(code));

/** A character in a role or directive name, like mystmd's bare word */
const isNameChar = charClass(/[\w:-]/);
/** A character in an inline option's key, class or id */
const isKeyChar = charClass(/[\w-]/);
/** A character inside the braces; like a backtick fence's info string, we don't allow backticks */
const inBraces = (code: Code) =>
  code !== codes.eof && code !== codes.rightCurlyBrace && code !== codes.graveAccent && !markdownLineEnding(code);

/**
 * The inside of a role's or directive's braces and the `}` after it, like mystmd's `inlineAttributes`.
 * The inside is words separated by whitespace: a name, then options like `.class`, `#id`, `key=value` or `key="a value"`.
 * A directive's name is optional, and anything mystmd rejects, like a second name or a word like `a.b`, is `nok`, so it's text or code.
 */
export function factoryHeader(
  effects: Effects,
  ok: State,
  nok: State,
  nameType: TokenType,
  markerType: TokenType,
  nameRequired = false,
): State {
  const option: Construct = { tokenize: tokenizeInlineOption, partial: true };
  let words = 0;
  let ids = 0;
  return factorySpace(effects, first, types.whitespace);

  // Like in mystmd, a first word like `key=value` is an option, not the name
  function first(code: Code) {
    return effects.attempt(option, nameRequired ? nok : after, nameStart)(code);
  }

  function nameStart(code: Code) {
    if (!isNameChar(code)) return end(code);
    effects.enter(nameType);
    return name(code);
  }

  function name(code: Code): State | undefined {
    if (isNameChar(code)) {
      effects.consume(code);
      return name;
    }
    effects.exit(nameType);
    return after(code);
  }

  // A word ends at whitespace or the `}`
  function after(code: Code) {
    words++;
    return markdownSpace(code) ? factorySpace(effects, next, types.whitespace)(code) : end(code);
  }

  function next(code: Code) {
    return code === codes.rightCurlyBrace ? end(code) : effects.attempt(option, after, nok)(code);
  }

  function end(code: Code) {
    if (code !== codes.rightCurlyBrace || !words) return nok(code);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    return ok;
  }

  // An inline option, whose value in `key=value` is parsed as inline markdown
  function tokenizeInlineOption(effects: Effects, ok: State, nok: State): State {
    let quoted = false;
    return start;

    function start(code: Code) {
      effects.enter('mystOption', { _location: 'inline' } as Partial<MicromarkToken>);
      if (code === codes.numberSign) {
        // mystmd allows one id
        if (ids) return nok(code);
        ids++;
      }
      if (code === codes.dot || code === codes.numberSign) {
        marker(code);
        return code === codes.dot ? wordStart : idStart;
      }
      if (!isKeyChar(code)) return nok(code);
      effects.enter('mystOptionName');
      return key(code);
    }

    // mystmd doesn't allow an id that starts with a digit
    function idStart(code: Code) {
      return asciiDigit(code) ? nok(code) : wordStart(code);
    }

    function wordStart(code: Code) {
      if (!isKeyChar(code)) return nok(code);
      effects.enter('mystOptionValue');
      return word(code);
    }

    function word(code: Code): State | undefined {
      if (isKeyChar(code)) {
        effects.consume(code);
        return word;
      }
      effects.exit('mystOptionValue');
      return end(code);
    }

    function key(code: Code): State | undefined {
      if (isKeyChar(code)) {
        effects.consume(code);
        return key;
      }
      if (code !== codes.equalsTo) return nok(code);
      effects.exit('mystOptionName');
      marker(code);
      return valueStart;
    }

    function valueStart(code: Code) {
      if (code === codes.quotationMark && !quoted) {
        quoted = true;
        marker(code);
        return valueStart;
      }
      // An empty value would be an empty token, which micromark can't slice
      if (!isValueChar(code)) return nok(code);
      effects.enter('mystOptionValue');
      effects.enter(types.chunkText, { contentType: constants.contentTypeText });
      return value(code);
    }

    function value(code: Code): State | undefined {
      if (!isValueChar(code)) {
        effects.exit(types.chunkText);
        effects.exit('mystOptionValue');
        if (!quoted) return end(code);
        if (code !== codes.quotationMark) return nok(code);
        marker(code);
        return end;
      }
      effects.consume(code);
      // In quotes, a backslash escapes the next character, like `\"`
      return quoted && code === codes.backslash ? escaped : value;
    }

    function escaped(code: Code) {
      if (!inBraces(code)) return nok(code);
      effects.consume(code);
      return value;
    }

    // A quoted value ends at its `"`, and an unquoted one at whitespace or a quote
    function isValueChar(code: Code) {
      if (!inBraces(code) || code === codes.quotationMark) return false;
      return quoted || (!markdownSpace(code) && code !== codes.apostrophe);
    }

    function marker(code: Code) {
      effects.enter('mystOptionMarker');
      effects.consume(code);
      effects.exit('mystOptionMarker');
    }

    function end(code: Code) {
      effects.exit('mystOption');
      return ok(code);
    }
  }
}

export const atLineEnd = (code: Code) => code === codes.eof || markdownLineEnding(code);

/**
 * Consume codes with each line's characters in a `type` token and each line ending in its own,
 * which micromark needs to split the lines up again; `close` exits the last line's token.
 */
export function dataConsumer(effects: Effects, type: TokenType) {
  let open = false;
  const close = () => {
    if (open) effects.exit(type);
    open = false;
  };
  const consume = (code: Code) => {
    if (markdownLineEnding(code)) {
      close();
      effects.enter(types.lineEnding);
      effects.consume(code);
      effects.exit(types.lineEnding);
    } else {
      if (!open) effects.enter(type);
      open = true;
      effects.consume(code);
    }
  };
  return { consume, close };
}

/** A line ending (not the end of the file), followed by a line that isn't a lazy continuation of a paragraph */
export const nonLazyLine: Construct = { tokenize: tokenizeNonLazyLine, partial: true };

function tokenizeNonLazyLine(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  return start;

  function start(code: Code) {
    if (code === codes.eof) return nok(code);
    effects.enter(types.lineEnding);
    effects.consume(code);
    effects.exit(types.lineEnding);
    return lineStart;
  }

  function lineStart(code: Code) {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
  }
}

/** The mdast node being built */
export const current = (context: CompileContext) => context.stack[context.stack.length - 1] as any;

/** An mdast exit handler that just closes the node */
export function exit(this: CompileContext, token: Token) {
  this.exit(token);
}
