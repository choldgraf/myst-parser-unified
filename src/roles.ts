// MyST roles, like {sub}`2`, as a micromark extension.
// The body between the backticks is parsed as inline markdown by micromark itself,
// so its nodes get exact positions.
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { markdownLineEnding } from 'micromark-util-character';
import { codes, constants, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, Extension, State, Token as MicromarkToken } from 'micromark-util-types';
import { current, exit, factoryName } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mystRole: 'mystRole';
    mystRoleMarker: 'mystRoleMarker';
    mystRoleName: 'mystRoleName';
    mystRoleFence: 'mystRoleFence';
    mystRoleBody: 'mystRoleBody';
  }
}

/** micromark extension: `{name}` followed by a body in backticks, like a code span */
export function role(): Extension {
  return { text: { [codes.leftCurlyBrace]: { name: 'mystRole', tokenize: tokenizeRole } } };
}

function tokenizeRole(effects: Effects, ok: State, nok: State): State {
  let fenceSize = 0;
  let previous: MicromarkToken | undefined;
  // Like a code span, the body ends at a run of exactly as many backticks as it started with
  const closingFence: Construct = { tokenize: tokenizeClosingFence, partial: true };
  return start;

  function start(code: Code) {
    effects.enter('mystRole');
    effects.enter('mystRoleMarker');
    effects.consume(code); // `{`
    effects.exit('mystRoleMarker');
    return factoryName(effects, openFenceStart, nok, 'mystRoleName', 'mystRoleMarker');
  }

  function openFenceStart(code: Code) {
    if (code !== codes.graveAccent) return nok(code);
    effects.enter('mystRoleFence');
    return openFence(code);
  }

  function openFence(code: Code): State | undefined {
    if (code === codes.graveAccent) {
      fenceSize++;
      effects.consume(code);
      return openFence;
    }
    effects.exit('mystRoleFence');
    effects.enter('mystRoleBody');
    return bodyLine(code);
  }

  // Each line of the body is a chunk of text, linked to the one before, for micromark to parse later.
  // Like in a paragraph, whitespace at the start of a line isn't part of the text.
  function bodyLine(code: Code) {
    return factorySpace(effects, lineStart, types.whitespace)(code);
  }

  function lineStart(code: Code) {
    if (code === codes.graveAccent) return effects.check(closingFence, end, chunkStart)(code);
    return chunkStart(code);
  }

  function chunkStart(code: Code) {
    const token = effects.enter(types.chunkText, { contentType: constants.contentTypeText, previous });
    if (previous) previous.next = token;
    previous = token;
    return body(code);
  }

  function body(code: Code): State | undefined {
    if (code === codes.eof) return nok(code);
    if (code === codes.graveAccent) return effects.check(closingFence, chunkEnd, backticks)(code);
    effects.consume(code);
    if (markdownLineEnding(code)) {
      effects.exit(types.chunkText);
      return bodyLine;
    }
    return body;
  }

  // A run of backticks that doesn't close the body is part of it
  function backticks(code: Code): State | undefined {
    if (code !== codes.graveAccent) return body(code);
    effects.consume(code);
    return backticks;
  }

  function chunkEnd(code: Code) {
    effects.exit(types.chunkText);
    return end(code);
  }

  function end(code: Code) {
    effects.exit('mystRoleBody');
    effects.enter('mystRoleFence');
    return closeFence(code);
  }

  function closeFence(code: Code): State | undefined {
    if (code === codes.graveAccent) {
      effects.consume(code);
      return closeFence;
    }
    effects.exit('mystRoleFence');
    effects.exit('mystRole');
    return ok(code);
  }

  function tokenizeClosingFence(effects: Effects, ok: State, nok: State): State {
    let size = 0;
    return start;

    function start(code: Code) {
      effects.enter('mystRoleFence');
      return fence(code);
    }

    function fence(code: Code): State | undefined {
      if (code === codes.graveAccent) {
        size++;
        effects.consume(code);
        return fence;
      }
      effects.exit('mystRoleFence');
      return size === fenceSize ? ok(code) : nok(code);
    }
  }
}

/**
 * mdast extension: the same tree as mystmd's parser, before roles run.
 * `processed: false` tells mystmd's `applyRoles` to run the role.
 */
export function roleFromMarkdown(): FromMarkdownExtension {
  return {
    // Keep line endings in the body as text, like in a paragraph
    canContainEols: ['mystRoleBody'],
    enter: {
      mystRole(token) {
        this.enter({ type: 'mystRole', name: '', value: '', processed: false, children: [] }, token);
      },
      mystRoleName(token) {
        current(this).name = this.sliceSerialize(token);
      },
      mystRoleBody(token) {
        const value = this.sliceSerialize(token);
        current(this).value = value;
        this.enter({ type: 'mystRoleBody', value, children: [] }, token);
      },
    },
    exit: {
      mystRole: exit,
      mystRoleBody: exit,
    },
  };
}
