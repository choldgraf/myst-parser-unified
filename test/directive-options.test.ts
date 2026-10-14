import { expect, test } from 'vitest';
import { parse } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// myst-spec has no YAML options, so compare these with mystmd's parser
const cases = {
  'a block with two keys': '```{note}\n---\nclass: tip\nname: x\n---\n```',
  'a block, then body text': '```{note}\n---\nclass: tip\n---\nBody *text*\n```',
  'a blank line in the block': '```{note}\n---\na: b\n\nc: d\n---\nBody\n```',
  'a block with no closing `---`': '```{note}\n---\na: b\n```',
  '`---` on the second body line, which is body': '```{note}\nBody\n---\na: b\n---\n```',
  'a block, then `:key:` lines, which are body': '```{note}\n---\na: b\n---\n:c: d\nBody\n```',
  'a block in a nested directive': '::::{note}\n:::{tip}\n---\nclass: x\n---\nInner\n:::\n::::',
};

test.each(Object.entries(cases))('%s parses like mystmd', (_, src) => {
  expect(normalize(parse(src))).toEqual(normalize(mystmd(src)));
});

// When a `---` block isn't options, mystmd's nested parse of the body drops it as front matter,
// so compare only the options and the body's text; docs/differences.md covers this
const notOptions = {
  'a key twice': '```{note}\n---\nclass: a\nclass: b\n---\n```',
  'an empty block': '```{note}\n---\n---\nBody\n```',
  'no closing `---` and a line that is not a key': '```{note}\n---\na: b\nBody\n```',
  '`:key:` lines, then a block': '```{note}\n:c: d\n---\na: b\n---\nBody\n```',
};

test.each(Object.entries(notOptions))('%s is body, like in mystmd', (_, src) => {
  const [ours, theirs] = [parse(src), mystmd(src)].map((tree) => tree.children[0] as any);
  expect([ours.options, ours.value]).toEqual([theirs.options, theirs.value]);
});

// docs/differences.md covers this
test('a value that looks like a number is a string here, and a number in mystmd', () => {
  const src = '```{note}\n---\nwidth: 1.0\n---\n```';
  expect((parse(src).children[0] as any).options).toEqual({ width: '1.0' });
  expect((mystmd(src).children[0] as any).options).toEqual({ width: 1 });
});

// mystmd has no exact columns, so check positions against the source
test('YAML options and the body after them span their source, with exact positions', () => {
  const src = '> ```{note}\n> ---\n> class: tip\n> ---\n> Body *text*\n> ```';
  const [option, body] = (parse(src).children[0] as any).children[0].children;
  const span = (node: any) => src.slice(node.position.start.offset, node.position.end.offset);
  expect(span(option)).toBe('class: tip');
  expect(option.position.start).toEqual({ line: 3, column: 3, offset: 20 });
  expect(option.children[0].position.start).toEqual({ line: 3, column: 10, offset: 27 });
  expect(span(body.children[0])).toBe('Body *text*');
  expect(body.position.start).toEqual({ line: 5, column: 3, offset: 39 });
});
