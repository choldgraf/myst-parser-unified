// Definition lists, like markdown-it-deflist in mystmd: a term line, then descriptions starting with `: ` or `~ `.
// Each description is a micromark container, like a list item, so its content gets lazy lines, nesting and exact positions.
// A term is a one-line paragraph right before a description, or before one blank line and a description.
import type { Parent } from 'mdast';
import type { Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { markdownSpace } from 'micromark-util-character';
import { codes, types } from 'micromark-util-symbol';
import type { Code, Construct, Effects, Extension, Point, State, TokenizeContext } from 'micromark-util-types';
import { atLineEnd, exit } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    definitionDescription: 'definitionDescription';
    definitionDescriptionMarker: 'definitionDescriptionMarker';
    definitionDescriptionIndent: 'definitionDescriptionIndent';
  }
  interface Token {
    /** Where a description's line starts, before any indent */
    _lineStart?: Point;
  }
  interface ParseContext {
    /** The column where each line's content starts, for lines that start a paragraph */
    blockStarts?: Map<number, number>;
  }
}

/** micromark extension: definition descriptions, and where blocks start so that they can find their terms */
export function definitionList(): Extension {
  const description: Construct = {
    name: 'definitionDescription',
    tokenize: tokenizeDescription,
    continuation: { tokenize: tokenizeContinuation },
    exit: (effects) => void effects.exit('definitionDescription'),
  };
  return {
    document: { [codes.colon]: description, [codes.tilde]: description },
    // Before every other flow construct that can start on any character, like tables
    flow: { null: { tokenize: tokenizeBlockStart } },
  };
}

/** Where the current line's content starts, inside its containers: before any indent */
function lineStart(self: TokenizeContext): Point {
  const tail = self.events[self.events.length - 1];
  return tail && tail[1].type === types.linePrefix && tail[0] === 'exit' ? tail[1].start : self.now();
}

// Never matches: it records where each paragraph (or table) starts, so that descriptions can find their term.
// Blank lines, indented code, headings, fences and the like match earlier constructs, so they never get here.
function tokenizeBlockStart(this: TokenizeContext, _effects: Effects, _ok: State, nok: State): State {
  // A paragraph checks whether the next line interrupts it, and that check isn't a block start
  if (!this.interrupt) (this.parser.blockStarts ??= new Map()).set(this.now().line, lineStart(this).column);
  return nok;
}

const blankLine: Construct = { tokenize: tokenizeBlankLine, partial: true };

function tokenizeBlankLine(effects: Effects, ok: State, nok: State): State {
  return factorySpace(effects, (code) => (atLineEnd(code) ? ok(code) : nok(code)), types.whitespace);
}

// `:` or `~`, a space, and something after it, after a term or another description
function tokenizeDescription(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const start = lineStart(self);
  return marker;

  function marker(code: Code) {
    if (!afterTerm(self, start) && !afterDescription(self, start)) return nok(code);
    effects.enter('definitionDescription', { _container: true, _lineStart: start });
    effects.enter('definitionDescriptionMarker');
    effects.consume(code);
    effects.exit('definitionDescriptionMarker');
    return space;
  }

  function space(code: Code) {
    if (!markdownSpace(code)) return nok(code);
    effects.enter(types.whitespace);
    effects.consume(code);
    effects.exit(types.whitespace);
    // Lines after the first need the marker's indent plus two
    self.containerState!.size = self.now().column - start.column;
    return effects.check(blankLine, nok, ok);
  }
}

// micromark runs this twice for a new container: to check, then again after closing the paragraph before it,
// so it only looks at what that doesn't change: the lines before this one, and the document's own tokens.
function afterTerm(self: TokenizeContext, start: Point): boolean {
  let index = self.events.length;
  while (index--) {
    const [kind, token] = self.events[index];
    if (token.type === types.chunkFlow) break;
    // A container or list item that started on this line ended the paragraph before it
    if (kind === 'enter' && (token._container || token.type === types.listItemPrefix)) return false;
  }
  if (index < 0) return false;
  // That chunk is the line before. If it's blank, the term is the line before that.
  const previousLineBlank = !self.sliceSerialize(self.events[index][1]).trim();
  const term = start.line - (previousLineBlank ? 2 : 1);
  return self.parser.blockStarts?.get(term) === start.column;
}

// The description before, at the same depth, that this line closes
function afterDescription(self: TokenizeContext, start: Point): boolean {
  for (let index = self.events.length; index--; ) {
    const token = self.events[index][1];
    if (token.type === 'definitionDescription' && token._lineStart!.column === start.column) {
      // Still open, or closed on this line, which micromark does before running this again
      return !token.end || token.end.line === start.line;
    }
  }
  return false;
}

// A blank line, or a line indented by the description's size
function tokenizeContinuation(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const size = self.containerState!.size as number;
  const indent = factorySpace(effects, afterIndent, 'definitionDescriptionIndent', size + 1);
  return effects.check(blankLine, factorySpace(effects, ok, types.linePrefix, size + 1), indent);

  function afterIndent(code: Code) {
    const tail = self.events[self.events.length - 1];
    // factorySpace stops early at a shorter indent
    const indented = tail[1].type === 'definitionDescriptionIndent' && tail[1].end.column - tail[1].start.column === size;
    return indented ? ok(code) : nok(code);
  }
}

/** mdast extension: the same nodes as mystmd's parser */
export function definitionListFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      definitionDescription(token) {
        this.enter({ type: 'definitionDescription', children: [] }, token);
      },
    },
    exit: { definitionDescription: exit },
    transforms: [groupDefinitionLists],
  };
}

/** Put each description, and the paragraph before it that is its term, in a definition list */
function groupDefinitionLists(node: any) {
  if (!node.children) return;
  const children: any[] = [];
  for (const child of node.children) {
    groupDefinitionLists(child);
    if (child.type !== 'definitionDescription') {
      children.push(child);
      continue;
    }
    // Like markdown-it, a description ends at its content, not at the blank lines after it
    child.position.end = child.children[child.children.length - 1].position.end;
    const items = [child];
    if (children.at(-1)?.type === 'paragraph') {
      const { children: phrasing, position } = children.pop();
      items.unshift({ type: 'definitionTerm', children: phrasing, position });
    }
    let list = children.at(-1);
    if (list?.type !== 'definitionList') {
      list = { type: 'definitionList', children: [], position: { start: items[0].position.start } };
      children.push(list);
    }
    list.children.push(...items);
    list.position.end = child.position.end;
  }
  node.children = children;
  for (const child of children) if (child.type === 'definitionList' && isTight(child)) unwrapParagraphs(child);
}

/** Like markdown-it-deflist: a list is loose if a blank line is inside a description, or between two descriptions */
function isTight(list: Parent): boolean {
  const blankBetween = (a: any, b: any) => b.position.start.line > a.position.end.line + 1;
  return !list.children.some((item: any, i) => {
    const next: any = list.children[i + 1];
    if (item.type !== 'definitionDescription') return false;
    const blankInside = item.children.some((child: any, j: number) => j && blankBetween(item.children[j - 1], child));
    return blankInside || (next?.type === 'definitionDescription' && blankBetween(item, next));
  });
}

/** In a tight list, a description's paragraphs become their phrasing content */
function unwrapParagraphs(list: Parent) {
  for (const item of list.children as Parent[]) {
    if (item.type === 'definitionDescription') {
      item.children = item.children.flatMap((child: any) => (child.type === 'paragraph' ? child.children : [child]));
    }
  }
}
