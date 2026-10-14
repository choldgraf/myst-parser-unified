// Dollar math and amsmath environments, as micromark extensions that follow mystmd's
// markdown-it-dollarmath and markdown-it-amsmath, rule for rule:
// - `$x$` is inline math, and `$$x$$` in a paragraph is display math; a `$` after an odd number of backslashes doesn't close it.
// - A `$$` block ends at the first line that ends with `$$`, or with `$$ (label)`, and can't have blank lines or interrupt a paragraph.
// - `\begin{equation}` and the other top-level environments end at the matching `\end{…}`, wherever it is.
// Like mystmd, the blocks run on through lazy lines, and a container like a list can't start inside them.
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { codes } from 'micromark-util-symbol';
import type { Code, Effects, Extension, State, TokenizeContext } from 'micromark-util-types';
import { atLineEnd, charClass, current, dataConsumer, exit } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mathInline: 'mathInline';
    mathBlock: 'mathBlock';
    mathEnvironment: 'mathEnvironment';
    mathEnvironmentValue: 'mathEnvironmentValue';
    mathData: 'mathData';
  }
}

/** micromark extension: `$x$`, `$$x$$`, `$$` blocks and amsmath environments */
export function math(): Extension {
  return {
    text: { [codes.dollarSign]: { name: 'mathInline', tokenize: tokenizeInline } },
    flow: {
      [codes.dollarSign]: { name: 'mathBlock', tokenize: tokenizeBlock, concrete: true },
      [codes.backslash]: { name: 'mathEnvironment', tokenize: tokenizeEnvironment, concrete: true },
    },
  };
}

// `$x$` or `$$x$$`, which can run over lines in the same paragraph
function tokenizeInline(effects: Effects, ok: State, nok: State): State {
  const data = dataConsumer(effects, 'mathData');
  let double = false;
  let empty = true;
  let backslashes = 0;
  return start;

  function start(code: Code) {
    effects.enter('mathInline');
    data.consume(code);
    return open;
  }

  function open(code: Code) {
    if (code !== codes.dollarSign) return inside(code);
    double = true;
    data.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (code === codes.eof) return nok(code);
    if (code === codes.dollarSign && backslashes % 2 === 0) {
      data.consume(code);
      return double ? closeDouble : close;
    }
    backslashes = code === codes.backslash ? backslashes + 1 : 0;
    empty = false;
    data.consume(code);
    return inside;
  }

  // In `$$x$$`, a single `$` is part of the math
  function closeDouble(code: Code) {
    if (code !== codes.dollarSign) {
      backslashes = 0;
      return inside(code);
    }
    data.consume(code);
    return close;
  }

  function close(code: Code) {
    if (empty) return nok(code);
    data.close();
    effects.exit('mathInline');
    return ok(code);
  }
}

/** Where the math ends in a `$$` block's last line, and its label, if the line closes the block */
function closing(line: string): { end: number; label?: string } | undefined {
  const trimmed = line.trimEnd();
  if (trimmed.endsWith('$$')) return { end: trimmed.length - 2 };
  // markdown-it-dollarmath matches this on the reversed line, which finds the same label
  const match = /\$\$\s*\(([^)$\r\n]+)\)\s*$/.exec(line);
  if (match) return { end: match.index, label: match[1].replace(/\s+/g, '-') };
}

// `$$` up to a line that closes it; the first line closes it only if it has more than `$$` and one character
function tokenizeBlock(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const data = dataConsumer(effects, 'mathData');
  let line = '';
  let first = true;
  return start;

  function start(code: Code) {
    if (self.interrupt) return nok(code);
    effects.enter('mathBlock');
    data.consume(code);
    return secondDollar;
  }

  function secondDollar(code: Code) {
    if (code !== codes.dollarSign) return nok(code);
    line = '$$';
    data.consume(code);
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (!atLineEnd(code)) {
      // A tab is a space here, which is all `closing` needs
      line += code! < 0 ? ' ' : String.fromCharCode(code!);
      data.consume(code);
      return inside;
    }
    if ((!first || line.trim().length > 3) && closing(line)) {
      data.close();
      effects.exit('mathBlock');
      return ok(code);
    }
    if (code === codes.eof || (!first && !line.trim())) return nok(code);
    first = false;
    line = '';
    data.consume(code);
    return inside;
  }
}

const isNameChar = charClass(/[a-zA-Z*]/);
// The environments that markdown-it-amsmath takes at the top level, with an optional `*`
const environments = /^(equation|multline|gather|align|alignat|flalign|[pbBvV]?matrix|eqnarray)\*?$/;

// `\begin{name}` up to the first `\end{name}`, then the rest of that line, which mystmd drops
function tokenizeEnvironment(effects: Effects, ok: State, nok: State): State {
  const data = dataConsumer(effects, 'mathData');
  const begin = '\\begin{';
  let name = '';
  let end = '';
  // How much of `begin`, and then of `end`, matches so far
  let index = 0;
  return start;

  function start(code: Code) {
    effects.enter('mathEnvironment');
    effects.enter('mathEnvironmentValue');
    return beginning(code);
  }

  function beginning(code: Code): State | undefined {
    if (code !== begin.charCodeAt(index)) return nok(code);
    data.consume(code);
    return ++index < begin.length ? beginning : environment;
  }

  function environment(code: Code): State | undefined {
    if (code === codes.rightCurlyBrace && environments.test(name)) {
      data.consume(code);
      end = `\\end{${name}}`;
      index = 0;
      return inside;
    }
    if (!isNameChar(code)) return nok(code);
    name += String.fromCharCode(code!);
    data.consume(code);
    return environment;
  }

  // `\` only comes first in `end`, so a mismatch restarts the search at this character
  function inside(code: Code): State | undefined {
    if (code === codes.eof) return nok(code);
    index = code === end.charCodeAt(index) ? index + 1 : code === codes.backslash ? 1 : 0;
    data.consume(code);
    if (index < end.length) return inside;
    data.close();
    effects.exit('mathEnvironmentValue');
    return after;
  }

  function after(code: Code): State | undefined {
    if (atLineEnd(code)) {
      data.close();
      effects.exit('mathEnvironment');
      return ok(code);
    }
    data.consume(code);
    return after;
  }
}

/** mystmd's `normalizeLabel` (myst-common), for a label that has no whitespace */
function normalizeLabel(label: string) {
  const identifier = label.replace(/['‘’"“”]+/g, '').toLowerCase();
  const html_id = identifier
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^([0-9-])/, 'id-$1')
    .replace(/-[-]+/g, '-')
    .replace(/(?:^[-]+)|(?:[-]+$)/g, '');
  return { identifier, label, html_id };
}

/** mdast extension: the same nodes as mystmd's parser */
export function mathFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      mathInline(token) {
        const text = this.sliceSerialize(token);
        if (!text.startsWith('$$')) this.enter({ type: 'inlineMath', value: text.slice(1, -1) }, token);
        else this.enter({ type: 'math', value: text.slice(2, -2).trim() }, token);
      },
      mathBlock(token) {
        const text = this.sliceSerialize(token);
        // The block's last line is the one that closes it
        const lastLine = text.search(/[^\r\n]*$/);
        const { end, label } = closing(text.slice(lastLine))!;
        const value = text.slice(2, lastLine + end).trim();
        this.enter({ type: 'math', value, ...(label && normalizeLabel(label)) }, token);
      },
      mathEnvironment(token) {
        this.enter({ type: 'math', value: '' }, token);
      },
      mathEnvironmentValue(token) {
        current(this).value = this.sliceSerialize(token);
      },
    },
    exit: {
      mathInline: exit,
      mathBlock: exit,
      mathEnvironment: exit,
    },
  };
}
