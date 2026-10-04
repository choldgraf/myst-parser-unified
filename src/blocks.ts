// MyST targets `(label)=`, comments `% text` and block breaks `+++`, as micromark extensions.
// Each one is a line of its own, and can interrupt a paragraph.
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { markdownSpace } from 'micromark-util-character';
import { codes, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, Extension, State } from 'micromark-util-types';
import { atLineEnd, current, exit, nonLazyLine } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mystTarget: 'mystTarget';
    mystTargetMarker: 'mystTargetMarker';
    mystTargetLabel: 'mystTargetLabel';
    mystComment: 'mystComment';
    mystCommentLine: 'mystCommentLine';
    mystBlockBreak: 'mystBlockBreak';
    mystBlockBreakSequence: 'mystBlockBreakSequence';
    mystBlockBreakMeta: 'mystBlockBreakMeta';
  }
}

/** micromark extension: targets, comments and block breaks */
export function blocks(): Extension {
  return {
    flow: {
      [codes.leftParenthesis]: { name: 'mystTarget', tokenize: tokenizeTarget },
      [codes.percentSign]: { name: 'mystComment', tokenize: tokenizeComment },
      // This runs before CommonMark's lists, so `+ + +` is a block break, not a list
      [codes.plusSign]: { name: 'mystBlockBreak', tokenize: tokenizeBlockBreak },
    },
  };
}

const labelChar = /[a-zA-Z0-9|@<>*./_\-+:]/;
const isLabelChar = (code: Code) => code !== null && code > 0 && labelChar.test(String.fromCharCode(code));

// `(label)=`, with up to 100 characters in the label
function tokenizeTarget(effects: Effects, ok: State, nok: State): State {
  let size = 0;
  return start;

  function start(code: Code) {
    effects.enter('mystTarget');
    effects.enter('mystTargetMarker');
    effects.consume(code); // `(`
    effects.exit('mystTargetMarker');
    effects.enter('mystTargetLabel');
    return label;
  }

  function label(code: Code): State | undefined {
    if (code === codes.rightParenthesis && size) {
      effects.exit('mystTargetLabel');
      effects.enter('mystTargetMarker');
      effects.consume(code);
      return equals;
    }
    if (!isLabelChar(code) || ++size > 100) return nok(code);
    effects.consume(code);
    return label;
  }

  function equals(code: Code) {
    if (code !== codes.equalsTo) return nok(code);
    effects.consume(code);
    effects.exit('mystTargetMarker');
    return factorySpace(effects, end, types.whitespace);
  }

  function end(code: Code) {
    if (!atLineEnd(code)) return nok(code);
    effects.exit('mystTarget');
    return ok(code);
  }
}

// `% text`, and the `%` lines right after it
function tokenizeComment(effects: Effects, ok: State, nok: State): State {
  const nextLine: Construct = { tokenize: tokenizeNextCommentLine, partial: true };
  return start;

  function start(code: Code) {
    effects.enter('mystComment');
    return lineStart(code);
  }

  function lineStart(code: Code) {
    effects.enter('mystCommentLine');
    return line(code);
  }

  function line(code: Code): State | undefined {
    if (!atLineEnd(code)) {
      effects.consume(code);
      return line;
    }
    effects.exit('mystCommentLine');
    if (code === codes.eof) return end(code);
    return effects.attempt(nextLine, lineStart, end)(code);
  }

  function end(code: Code) {
    effects.exit('mystComment');
    return ok(code);
  }
}

// A line ending, then a line (that isn't a lazy paragraph line) starting with `%`, with any indent
function tokenizeNextCommentLine(effects: Effects, ok: State, nok: State): State {
  const percent = (code: Code) => (code === codes.percentSign ? ok(code) : nok(code));
  return effects.attempt(nonLazyLine, factorySpace(effects, percent, types.linePrefix), nok);
}

// `+++`, with optional spaces between the `+` and metadata after them, like `+++ {"a": 1}`
function tokenizeBlockBreak(effects: Effects, ok: State, nok: State): State {
  let size = 0;
  return start;

  function start(code: Code) {
    effects.enter('mystBlockBreak');
    effects.enter('mystBlockBreakSequence');
    return sequence(code);
  }

  function sequence(code: Code): State | undefined {
    if (code === codes.plusSign || markdownSpace(code)) {
      if (code === codes.plusSign) size++;
      effects.consume(code);
      return sequence;
    }
    if (size < 3) return nok(code);
    effects.exit('mystBlockBreakSequence');
    if (atLineEnd(code)) return end(code);
    effects.enter('mystBlockBreakMeta');
    return meta(code);
  }

  function meta(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit('mystBlockBreakMeta');
      return end(code);
    }
    effects.consume(code);
    return meta;
  }

  function end(code: Code) {
    effects.exit('mystBlockBreak');
    return ok(code);
  }
}

/** mdast extension: the same nodes as mystmd's parser */
export function blocksFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      mystTarget(token) {
        this.enter({ type: 'mystTarget', label: '' }, token);
      },
      mystTargetLabel(token) {
        current(this).label = this.sliceSerialize(token);
      },
      mystComment(token) {
        // Like mystmd: drop each line's `%` and trailing whitespace, then trim the whole comment
        const lines = this.sliceSerialize(token).split(/\r?\n/);
        const value = lines.map((line) => line.trimStart().slice(1).trimEnd()).join('\n').trim();
        this.enter({ type: 'comment', value }, token);
      },
      mystBlockBreak(token) {
        this.enter({ type: 'blockBreak' }, token);
      },
      mystBlockBreakMeta(token) {
        current(this).meta = this.sliceSerialize(token).trim();
      },
    },
    exit: {
      mystTarget: exit,
      mystComment: exit,
      mystBlockBreak: exit,
    },
  };
}
