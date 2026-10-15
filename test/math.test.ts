import { expect, test } from 'vitest';
import { parse, toMystmd } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// myst-spec has no dollar math or amsmath examples, so compare these with mystmd's parser.
// toMystmd only adapts the list item's `spread` in one of these, not the math.
const cases = {
  'a label on one line': '$$ x $$ (eq1)',
  'a label after the closing fence': '$$\nx\n$$ (eq1)',
  'a label with spaces': '$$ x $$ (my label)',
  'a label with a $, which is not a label': '$$ x $$ (a$b)',
  'a label with a ), which is not a label': '$$ x $$ (a)b)',
  'display math on one line': '$$ x $$',
  'display math in a paragraph': 'a $$x$$ b\n$$\ny\n$$',
  'a $$ block with a blank line, which is not a block': '$$\nx\n\ny\n$$',
  'an unclosed $$ block': '$$\nx',
  'inline math': '$x$, $ y $, $a\\$b$ and $c\nd$',
  'inline math in a block quote': '> $x$ and $$y\n> z$$',
  'equation': '\\begin{equation}\nx\n\\end{equation}',
  'equation*': '\\begin{equation*}\nx\n\\end{equation*}',
  'align': '\\begin{align}\na &= b\n\\end{align}',
  'a matrix at the top level': '\\begin{pmatrix}\na\n\\end{pmatrix}',
  'aligned, which is not top level': '\\begin{aligned}\na\n\\end{aligned}',
  'an environment after a paragraph line, with text after it': 'text\n\\begin{equation}\na\n\nb\n\\end{equation} dropped',
  'an unterminated environment': '\\begin{equation}\nx',
  'an environment in a directive': '```{note}\n\\begin{equation}\nx\n\\end{equation}\n```',
  'math in a list item': '- $$\n  x\n  $$ (A B)\n- \\begin{equation}x\\end{equation}',
};

test.each(Object.entries(cases))('%s parses like mystmd', (_, src) => {
  expect(normalize(toMystmd(parse(src)))).toEqual(normalize(mystmd(src, { nestBlocks: false })));
});

// mystmd slices the source, so it keeps the list item's indent in the value. docs/differences.md covers this
test('an environment in a list item has no indent in its value', () => {
  const src = '- \\begin{equation}\n  x\n  \\end{equation}';
  expect((parse(src) as any).children[0].children[0].children[0].value).toBe('\\begin{equation}\nx\n\\end{equation}');
});

// mystmd has no exact columns, so check positions against the source
test('math nodes span their source, with exact positions', () => {
  const src = 'Text $x$ and\n$$y$$.\n\n  $$\n  z\n  $$ (eq 1)\n\n\\begin{align}\na\n\\end{align} tail';
  const [paragraph, block, environment] = parse(src).children as any[];
  const span = (node: any) => src.slice(node.position.start.offset, node.position.end.offset);
  expect(paragraph.children.filter((node: any) => node.type !== 'text').map(span)).toEqual(['$x$', '$$y$$']);
  expect(paragraph.children[1].position.start).toEqual({ line: 1, column: 6, offset: 5 });
  expect(paragraph.children[3].position.start).toEqual({ line: 2, column: 1, offset: 13 });
  expect(span(block)).toBe('$$\n  z\n  $$ (eq 1)');
  expect(block.position.start).toEqual({ line: 4, column: 3, offset: 23 });
  expect(span(environment)).toBe('\\begin{align}\na\n\\end{align} tail');
});
