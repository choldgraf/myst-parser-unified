// MyST citations, like @key and [see @key, p. 3; -@other], as a micromark extension.
// Each construct looks ahead with a check, matches mystmd's own patterns on what it saw,
// and then consumes just the match, so the mdast nodes get the fields and the exact span.
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { markdownLineEnding, markdownLineEndingOrSpace } from 'micromark-util-character';
import { codes, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, Event, Extension, State, TokenizeContext } from 'micromark-util-types';
import { charClass, dataConsumer, exit } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    cite: 'cite';
    citeGroup: 'citeGroup';
    citeData: 'citeData';
    citeGroupMarker: 'citeGroupMarker';
  }
  interface Token {
    _cite?: Citation;
  }
}

/** The fields of a `cite` node */
export type Citation = {
  identifier: string;
  label: string;
  kind: 'narrative' | 'parenthetical';
  partial?: 'year';
  prefix?: string;
  suffix?: string;
};

// mystmd's patterns, from markdown-it-myst's citations.js
const narrative = /^@((?:[\w|{][\w:.#$%&\-+?~/]*[\w|}])|\w)(\s*)(\[([^\]]{1,50})\])?/;
const parenthetical = /^([^^-]|[^^].+?)?(-)?@([\w][\w:.#$%&\-+?~/]*)(.+)?$/;
const isAlphanumeric = charClass(/[a-zA-Z0-9]/);
const isKeyChar = charClass(/[\w:.#$%&\-+?~/|{}]/);

/** micromark extension: `@key` with an optional `[suffix]`, and `[prefix @key suffix; ...]` */
export function citation(): Extension {
  return {
    text: {
      [codes.atSign]: { name: 'cite', tokenize: tokenizeNarrative, previous: (code) => !isAlphanumeric(code), resolveAll },
      [codes.leftSquareBracket]: { name: 'citeGroup', tokenize: tokenizeGroup, resolveAll },
    },
  };
}

/** A cite's fields from its label, like mystmd: `{key}` is `key`, and the identifier is lowercase */
function cite(kind: Citation['kind'], label: string, rest: Partial<Citation>): Citation {
  label = label.replace(/^\{(.*)\}$/, '$1');
  return { identifier: label.toLowerCase(), label, kind, ...rest };
}

/** One character per code, so that a match's length is the number of codes to consume */
const char = (code: Code) => (code! < codes.nul ? (markdownLineEnding(code) ? '\n' : ' ') : String.fromCharCode(code!));

/** Consume `size` codes as `citeData`, then go to `next` */
function factoryCount(effects: Effects, size: number, next: State): State {
  const data = dataConsumer(effects, 'citeData');
  return count;

  function count(code: Code): State | undefined {
    data.consume(code);
    if (--size) return count;
    data.close();
    return next;
  }
}

/** Like mystmd, an `@` in a URL-like word, like `https://x.com/@user` or `hackmd.com/@user`, isn't a citation */
function inUrl(self: TokenizeContext) {
  if (self.previous === codes.eof || markdownLineEndingOrSpace(self.previous)) return false;
  const text = self.sliceSerialize({ start: self.events[0][1].start, end: self.now() });
  const word = /\S+$/.exec(text)![0];
  // After a closed autolink, like `<https://x.com/@u> @key`, the `@` isn't part of the URL
  if (word.startsWith('<') && word.includes('>')) return false;
  return word.includes('://') || word.startsWith('www.') || /^([a-z0-9-]+\.)+[a-z]{2,}(\/|$)/i.test(word);
}

function tokenizeNarrative(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  let size = 0;
  let fields: Citation;
  const scan: Construct = { tokenize: tokenizeScan, partial: true };
  return start;

  function start(code: Code) {
    if (inUrl(self)) return nok(code);
    return effects.check(scan, open, nok)(code);
  }

  function open(code: Code) {
    effects.enter('cite', { _cite: fields });
    return factoryCount(effects, size, close)(code);
  }

  function close(code: Code) {
    effects.exit('cite');
    return ok(code);
  }

  // Look ahead over the key, and a `[suffix]` after it, then match mystmd's pattern on that
  function tokenizeScan(effects: Effects, ok: State, nok: State): State {
    let text = '';
    let seen = 0;
    return marker;

    function marker(code: Code) {
      effects.enter('cite');
      text = '@';
      effects.consume(code);
      return key;
    }

    function key(code: Code): State | undefined {
      if (!isKeyChar(code)) return space(code);
      text += char(code);
      effects.consume(code);
      return key;
    }

    function space(code: Code): State | undefined {
      if (!markdownLineEndingOrSpace(code)) return code === codes.leftSquareBracket ? bracket(code) : done(code);
      text += char(code);
      effects.consume(code);
      return space;
    }

    // A suffix is `[`, up to 50 characters and `]`, so stop looking after that
    function bracket(code: Code): State | undefined {
      if (code === codes.eof || seen > 51) return done(code);
      text += char(code);
      effects.consume(code);
      seen++;
      return code === codes.rightSquareBracket ? done : bracket;
    }

    function done(code: Code) {
      const match = narrative.exec(text);
      if (!match) return nok(code);
      const [whole, label, space, , suffix] = match;
      // Without a suffix, the space after the key isn't part of the citation
      size = whole.length - (suffix ? 0 : space.length);
      fields = cite('narrative', label, { suffix });
      return ok(code);
    }
  }
}

function tokenizeGroup(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  // What to consume inside the brackets: a cite, or the space and `;` around one
  let segments: { size: number; fields?: Citation }[];
  const scan: Construct = { tokenize: tokenizeScan, partial: true };
  return start;

  function start(code: Code) {
    return effects.check(scan, open, nok)(code);
  }

  function open(code: Code) {
    effects.enter('citeGroup');
    return marker(code, segment);
  }

  function marker(code: Code, next: State) {
    effects.enter('citeGroupMarker');
    effects.consume(code);
    effects.exit('citeGroupMarker');
    return next;
  }

  function segment(code: Code): State | undefined {
    const next = segments.shift();
    if (!next) return close(code);
    const { size, fields } = next;
    if (fields) effects.enter('cite', { _cite: fields });
    return factoryCount(effects, size, (code) => {
      if (fields) effects.exit('cite');
      return segment(code);
    })(code);
  }

  function close(code: Code) {
    return marker(code, done);
  }

  function done(code: Code) {
    effects.exit('citeGroup');
    return ok(code);
  }

  // Look ahead to the matching `]`, like markdown-it's parseLinkLabel, then match each `;`-separated part
  function tokenizeScan(effects: Effects, ok: State, nok: State): State {
    let text = '';
    let depth = 0;
    return open;

    function open(code: Code) {
      effects.enter('citeGroup');
      effects.consume(code);
      depth = 1;
      return inside;
    }

    function inside(code: Code): State | undefined {
      if (code === codes.eof) return nok(code);
      if (code === codes.leftSquareBracket) depth++;
      if (code === codes.rightSquareBracket && !--depth) {
        effects.consume(code);
        return after;
      }
      text += char(code);
      effects.consume(code);
      return code === codes.backslash ? escaped : inside;
    }

    function escaped(code: Code) {
      if (code === codes.eof) return nok(code);
      text += char(code);
      effects.consume(code);
      return inside;
    }

    // A label followed by `(` or `[` is a link
    function after(code: Code) {
      if (code === codes.leftParenthesis || code === codes.leftSquareBracket) return nok(code);
      const parts = text.split(';');
      const matches = parts.map((part) => parenthetical.exec(part));
      if (matches.includes(null)) return nok(code);
      segments = parts
        .flatMap((part, i) => {
          const [, prefix, partial, label, suffix] = matches[i]!;
          const fields = cite('parenthetical', label, {
            prefix: prefix?.trim() || undefined,
            suffix: suffix?.trim().replace(/^,\s*/, '') || undefined,
            partial: partial ? 'year' : undefined,
          });
          // A part is the space before the cite, the cite, and the space and `;` after it
          const leading = part.length - part.trimStart().length;
          const trailing = part.length - part.trimEnd().length + (i < parts.length - 1 ? 1 : 0);
          return [{ size: leading }, { size: part.trim().length, fields }, { size: trailing }];
        })
        .filter((segment) => segment.size);
      return ok(code);
    }
  }
}

/**
 * Citations inside the text of a link or image are text, like in mystmd.
 * Links are resolved by then, so their text is in `labelText` tokens.
 * Both constructs share this resolver, and micromark runs it once.
 */
function resolveAll(events: Event[]) {
  let depth = 0;
  for (let index = 0; index < events.length; index++) {
    const [kind, token] = events[index];
    if (token.type === types.labelText) depth += kind === 'enter' ? 1 : -1;
    else if (depth && kind === 'enter' && (token.type === 'cite' || token.type === 'citeGroup')) {
      let end = index;
      while (events[++end][1] !== token);
      const lineEndings = events.slice(index + 1, end).filter((event) => event[1].type === types.lineEnding);
      events.splice(index + 1, end - index - 1, ...lineEndings);
      token.type = types.data;
    }
  }
  return events;
}

/** mdast extension: `cite` nodes, and a `citeGroup` around the cites in brackets, like mystmd */
export function citationFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      cite(token) {
        this.enter({ type: 'cite', ...token._cite! }, token);
      },
      citeGroup(token) {
        this.enter({ type: 'citeGroup', kind: 'parenthetical', children: [] }, token);
      },
    },
    exit: {
      cite: exit,
      citeGroup: exit,
    },
  };
}
