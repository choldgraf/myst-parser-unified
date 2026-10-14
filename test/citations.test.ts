import { expect, test } from 'vitest';
import { parse } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// myst-spec has no citation examples, so compare these with mystmd's parser
const cases = {
  'a key': '@key',
  'a key before a full stop': 'See @key.',
  'a key with a suffix': '@key [p. 3]',
  'keys at the start of a line and after punctuation': '(@a) x,@b\n@c',
  'a group': '[@a; @b]',
  'a prefix and a suffix': '[see @key, p. 3]',
  'a year': '[-@key]',
  'a bracket where a part has no key': '[@a; b] and [@c; d](url)',
  'a key as link text': '[@key](url)',
  'keys in emphasis': '*@key* and _[@a]_',
  'keys in a directive body': '```{note}\n@key [p. 3]\n\n[@a; @b]\n```',
  'a group across lines': '[@a;\n@b]',
};

test.each(Object.entries(cases))('%s parses like mystmd', (_, src) => {
  expect(normalize(parse(src))).toEqual(normalize(mystmd(src, { nestBlocks: false })));
});

/** The cite nodes in a tree */
const cites = (node: any): any[] => (node.type === 'cite' ? [node] : (node.children ?? []).flatMap(cites));

// mystmd turns these into links with linkify, which docs/differences.md covers; neither parser sees a citation
test.each(['a@b.com', 'https://x.com/@user', 'hackmd.com/@user'])('%s has no citation, like mystmd', (src) => {
  expect(cites(parse(src))).toEqual([]);
  expect(cites(mystmd(src))).toEqual([]);
});

// docs/differences.md covers this difference
test('an `@` after an unclosed `<` is text here, and a citation in mystmd', () => {
  expect(cites(parse('<x\\+@y.com>'))).toEqual([]);
  expect(cites(mystmd('<x\\+@y.com>'))).toHaveLength(1);
});

// mystmd has no exact columns, so check positions against the source
test('cites and groups span their source, with exact positions', () => {
  const src = 'See [see @a, p. 3;\n -@b] and @c [p. 1].';
  const [, group, , cite] = (parse(src).children[0] as any).children;
  const span = (node: any) => src.slice(node.position.start.offset, node.position.end.offset);
  expect(span(group)).toBe('[see @a, p. 3;\n -@b]');
  expect(group.children.map(span)).toEqual(['see @a, p. 3', '-@b']);
  expect(group.children[1].position.start).toEqual({ line: 2, column: 2, offset: 20 });
  expect(span(cite)).toBe('@c [p. 1]');
});
