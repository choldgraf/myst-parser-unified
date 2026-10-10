// Helpers shared by the MyST micromark and mdast extensions
import type { CompileContext, Token } from 'mdast-util-from-markdown';
import { markdownLineEnding } from 'micromark-util-character';
import { codes, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, State, TokenizeContext, TokenType } from 'micromark-util-types';

const nameChar = /[a-zA-Z0-9_.\-+:]/;
/** A character in a role or directive name */
export const isNameChar = (code: Code) => code !== null && code > 0 && nameChar.test(String.fromCharCode(code));

/** A role or directive name and the `}` after it, as `nameType` and `markerType` tokens, then `ok` */
export function factoryName(effects: Effects, ok: State, nok: State, nameType: TokenType, markerType: TokenType): State {
  return start;

  function start(code: Code) {
    if (!isNameChar(code)) return nok(code);
    effects.enter(nameType);
    return name(code);
  }

  function name(code: Code): State | undefined {
    if (isNameChar(code)) {
      effects.consume(code);
      return name;
    }
    if (code !== codes.rightCurlyBrace) return nok(code);
    effects.exit(nameType);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    return ok;
  }
}

export const atLineEnd = (code: Code) => code === codes.eof || markdownLineEnding(code);

/** A line ending, followed by a line that isn't a lazy continuation of a paragraph */
export const nonLazyLine: Construct = { tokenize: tokenizeNonLazyLine, partial: true };

function tokenizeNonLazyLine(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  return start;

  function start(code: Code) {
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
