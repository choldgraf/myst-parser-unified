// MyST directives, like ```{note} with backtick, tilde or colon fences, as a micromark extension.
// The fence works like a fenced code block, and the body is parsed as markdown by micromark itself,
// so its nodes get exact positions. Modeled on micromark-extension-directive's container (MIT).
import type { CompileContext, Extension as FromMarkdownExtension, Token } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { markdownLineEnding, markdownLineEndingOrSpace } from 'micromark-util-character';
import { codes, constants, types } from 'micromark-util-symbol';
import type {
  Code,
  Construct,
  Effects,
  Extension,
  State,
  TokenizeContext,
  Token as MicromarkToken,
} from 'micromark-util-types';
import { atLineEnd, current, exit, factoryName, nonLazyLine } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mystDirective: 'mystDirective';
    mystDirectiveFence: 'mystDirectiveFence';
    mystDirectiveSequence: 'mystDirectiveSequence';
    mystDirectiveMarker: 'mystDirectiveMarker';
    mystDirectiveName: 'mystDirectiveName';
    mystDirectiveArg: 'mystDirectiveArg';
    mystDirectiveBody: 'mystDirectiveBody';
    mystOption: 'mystOption';
    mystOptionMarker: 'mystOptionMarker';
    mystOptionName: 'mystOptionName';
    mystOptionValue: 'mystOptionValue';
  }
}

/** micromark extension: a fence of three or more backticks, tildes or colons, followed by `{name}` */
export function directive(): Extension {
  const construct: Construct = { name: 'mystDirective', tokenize: tokenizeDirective, concrete: true };
  // These run before CommonMark's fenced code, which takes over when `{name}` is missing
  return { flow: { [codes.graveAccent]: construct, [codes.tilde]: construct, [codes.colon]: construct } };
}

const option: Construct = { tokenize: tokenizeOption, partial: true };

function tokenizeDirective(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const tail = self.events[self.events.length - 1];
  // Like in a fenced code block, lines in the body lose up to as much indent as the opening fence has
  const initialSize =
    tail && tail[1].type === types.linePrefix ? tail[2].sliceSerialize(tail[1], true).length : 0;
  const closingFence: Construct = { tokenize: tokenizeClosingFence, partial: true };
  let marker: Code;
  let sizeOpen = 0;
  // Options can only come right after the opening fence, before the body
  let inBody = false;
  let previous: MicromarkToken | undefined;
  return start;

  function start(code: Code) {
    marker = code;
    effects.enter('mystDirective');
    effects.enter('mystDirectiveFence');
    effects.enter('mystDirectiveSequence');
    return sequenceOpen(code);
  }

  function sequenceOpen(code: Code): State | undefined {
    if (code === marker) {
      sizeOpen++;
      effects.consume(code);
      return sequenceOpen;
    }
    if (sizeOpen < constants.codeFencedSequenceSizeMin) return nok(code);
    effects.exit('mystDirectiveSequence');
    return factorySpace(effects, nameOpen, types.whitespace)(code);
  }

  function nameOpen(code: Code) {
    if (code !== codes.leftCurlyBrace) return nok(code);
    effects.enter('mystDirectiveMarker');
    effects.consume(code);
    effects.exit('mystDirectiveMarker');
    return factoryName(effects, factorySpace(effects, argStart, types.whitespace), nok, 'mystDirectiveName', 'mystDirectiveMarker');
  }

  // The rest of the opening line is the argument, parsed as inline markdown
  function argStart(code: Code) {
    if (atLineEnd(code)) return openEnd(code);
    effects.enter('mystDirectiveArg');
    effects.enter(types.chunkText, { contentType: constants.contentTypeText });
    return arg(code);
  }

  function arg(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.chunkText);
      effects.exit('mystDirectiveArg');
      return openEnd(code);
    }
    // Like the info string of a fenced code block, a backtick fence's argument can't have backticks
    if (code === codes.graveAccent && marker === codes.graveAccent) return nok(code);
    effects.consume(code);
    return arg;
  }

  function openEnd(code: Code) {
    effects.exit('mystDirectiveFence');
    if (self.interrupt) return ok(code);
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function lineStart(code: Code) {
    const content = initialSize
      ? factorySpace(effects, lineContent, types.linePrefix, initialSize + 1)
      : lineContent;
    return effects.check(closingFence, close, content)(code);
  }

  // The closing fence comes after the body, not in it
  function close(code: Code) {
    if (inBody) effects.exit('mystDirectiveBody');
    return effects.attempt(closingFence, done, nok)(code);
  }

  function lineContent(code: Code) {
    if (!inBody && code === codes.colon) return effects.attempt(option, optionEnd, bodyStart)(code);
    return bodyStart(code);
  }

  function optionEnd(code: Code) {
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function bodyStart(code: Code) {
    // An empty body at the end of the document would be an empty token, which micromark can't slice
    if (code === codes.eof) return after(code);
    if (!inBody) {
      inBody = true;
      // The mdast handler needs this to remove the indent from `value`
      effects.enter('mystDirectiveBody', { _indent: initialSize } as Partial<MicromarkToken>);
    }
    return chunkStart(code);
  }

  // Each line of the body is a chunk of document, linked to the one before, for micromark to parse later
  function chunkStart(code: Code) {
    if (markdownLineEnding(code)) return effects.check(nonLazyLine, chunkNonLazyStart, after)(code);
    return chunkNonLazyStart(code);
  }

  function chunkNonLazyStart(code: Code) {
    const token = effects.enter(types.chunkDocument, { contentType: constants.contentTypeDocument, previous });
    if (previous) previous.next = token;
    previous = token;
    return chunkContinue(code);
  }

  function chunkContinue(code: Code): State | undefined {
    if (code === codes.eof) {
      chunkExit();
      return after(code);
    }
    if (markdownLineEnding(code)) return effects.check(nonLazyLine, chunkLineEnd, chunkLazyEnd)(code);
    effects.consume(code);
    return chunkContinue;
  }

  function chunkLineEnd(code: Code) {
    effects.consume(code);
    chunkExit();
    return lineStart;
  }

  function chunkLazyEnd(code: Code) {
    chunkExit();
    return after(code);
  }

  function chunkExit() {
    const token = effects.exit(types.chunkDocument);
    self.parser.lazy[token.start.line] = false;
  }

  // Ended without a closing fence: the directive ends where the body does
  function after(code: Code) {
    if (inBody) effects.exit('mystDirectiveBody');
    return done(code);
  }

  function done(code: Code) {
    effects.exit('mystDirective');
    return ok(code);
  }

  function tokenizeClosingFence(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    let size = 0;
    const indentMax = this.parser.constructs.disable.null?.includes('codeIndented') ? undefined : constants.tabSize;
    return factorySpace(effects, closeStart, types.linePrefix, indentMax);

    function closeStart(code: Code) {
      effects.enter('mystDirectiveFence');
      effects.enter('mystDirectiveSequence');
      return sequence(code);
    }

    function sequence(code: Code): State | undefined {
      if (code === marker) {
        size++;
        effects.consume(code);
        return sequence;
      }
      if (size < sizeOpen) return nok(code);
      effects.exit('mystDirectiveSequence');
      return factorySpace(effects, closeEnd, types.whitespace)(code);
    }

    function closeEnd(code: Code) {
      if (!atLineEnd(code)) return nok(code);
      effects.exit('mystDirectiveFence');
      return ok(code);
    }
  }
}

// An option line, like `:class: tip`, whose value is parsed as inline markdown
function tokenizeOption(effects: Effects, ok: State, nok: State): State {
  const isOptionNameChar = (code: Code) => code !== codes.colon && code !== codes.eof && !markdownLineEndingOrSpace(code);
  return start;

  function start(code: Code) {
    effects.enter('mystOption');
    effects.enter('mystOptionMarker');
    effects.consume(code); // `:`
    effects.exit('mystOptionMarker');
    return nameStart;
  }

  function nameStart(code: Code) {
    if (!isOptionNameChar(code)) return nok(code);
    effects.enter('mystOptionName');
    return name(code);
  }

  function name(code: Code): State | undefined {
    if (isOptionNameChar(code)) {
      effects.consume(code);
      return name;
    }
    if (code !== codes.colon) return nok(code);
    effects.exit('mystOptionName');
    effects.enter('mystOptionMarker');
    effects.consume(code);
    effects.exit('mystOptionMarker');
    return factorySpace(effects, valueStart, types.whitespace);
  }

  function valueStart(code: Code) {
    if (atLineEnd(code)) return end(code);
    effects.enter('mystOptionValue');
    effects.enter(types.chunkText, { contentType: constants.contentTypeText });
    return value(code);
  }

  function value(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.chunkText);
      effects.exit('mystOptionValue');
      return end(code);
    }
    effects.consume(code);
    return value;
  }

  function end(code: Code) {
    effects.exit('mystOption');
    return ok(code);
  }
}

/**
 * mdast extension: the same tree as mystmd's parser, before directives run.
 * `processed: false` tells mystmd's `applyDirectives` to run the directive.
 */
export function directiveFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      mystDirective(token) {
        this.enter({ type: 'mystDirective', name: '', processed: false, children: [] }, token);
      },
      mystDirectiveName(token) {
        current(this).name = this.sliceSerialize(token);
      },
      mystDirectiveArg(token) {
        const value = this.sliceSerialize(token).trim();
        current(this).args = value;
        this.enter({ type: 'mystDirectiveArg', value, children: [] }, token);
      },
      mystOption(token) {
        this.enter({ type: 'mystOption', name: '', location: 'colon', value: true, children: [] }, token);
      },
      mystOptionName(token) {
        current(this).name = this.sliceSerialize(token);
      },
      mystOptionValue(token) {
        current(this).value = this.sliceSerialize(token);
      },
      mystDirectiveBody(token) {
        // Like mystmd, remove the fence's indent, then blank lines at the start and whitespace at the end
        // (the first line's indent is already outside the body)
        const indent = new RegExp(`\n {0,${(token as any)._indent}}`, 'g');
        const value = this.sliceSerialize(token).replace(indent, '\n').replace(/^([ \t]*\r?\n)+/, '').trimEnd();
        current(this).value = value;
        this.enter({ type: 'mystDirectiveBody', value, children: [] }, token);
      },
    },
    exit: {
      mystDirective: exit,
      mystDirectiveArg: exit,
      mystOption: exitOption,
      mystDirectiveBody(token) {
        const body = current(this);
        this.exit(token);
        // A body of only blank lines is no body
        if (!body.value) {
          const directive = current(this);
          directive.children.pop();
          delete directive.value;
        }
      },
    },
  };
}

// Also collect options on the directive, like mystmd: `class` values add up, otherwise the first one wins
function exitOption(this: CompileContext, token: Token) {
  const { name, value } = current(this);
  this.exit(token);
  const directive = current(this);
  directive.options ??= {};
  if (name === 'class' && directive.options.class) directive.options.class += ` ${value}`;
  else if (directive.options[name] === undefined) directive.options[name] = value;
}
