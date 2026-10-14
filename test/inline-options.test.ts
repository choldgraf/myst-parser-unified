import { expect, test } from 'vitest';
import { parse } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// myst-spec has no spaces inside braces or inline options, so compare these with mystmd's parser
const cases = {
  'spaces inside the braces of a directive': '```{ note }\nBody\n```',
  'spaces inside the braces of a role': 'See { ref }`x`.',
  'a tab and several spaces inside the braces': '```{\tnote   }\nBody\n```',
  'a space before the name in a colon fence': ':::{ note}\nBody\n:::',
  'two classes': '```{note .a .b}\nBody\n```',
  'an id, which is the `label` option': '```{note #my-id}\nBody\n```',
  'an inline class and a `:class:` line, which add up': '```{note .a}\n:class: b\nBody\n```',
  'an inline id and a `:label:` line, where the first wins': '```{note #a}\n:label: b\nBody\n```',
  'inline options, then an argument': '```{note .a #b} An *argument*\nBody\n```',
  'no name, which is a `div`': ':::{.a}\nBody\n:::',
  'empty braces, which are a code block': '```{}\nBody\n```',
  'a role with a class': 'See {span .a}`text`.',
  'a role with an id and a `key=value`': 'See {span #a key=value}`text`.',
};

test.each(Object.entries(cases))('%s parses like mystmd', (_, src) => {
  expect(normalize(parse(src))).toEqual(normalize(mystmd(src)));
});

// mystmd parses a directive's `key=value` twice, so its text is doubled, like `valuevalue`;
// docs/differences.md covers this, so compare the options and the option's value
test.each([
  ['```{note key=value}\nBody\n```', 'value'],
  ['```{note key="a b"}\nBody\n```', 'a b'],
  ['```{note key=v}\n:key: w\nBody\n```', 'v'],
])('`%s` has the same options as in mystmd', (src, value) => {
  const [ours, theirs] = [parse(src), mystmd(src)].map((tree) => tree.children[0] as any);
  expect(ours.options).toEqual(theirs.options);
  expect(ours.children[0].value).toBe(value);
  expect(ours.children[0].children).toEqual([expect.objectContaining({ type: 'text', value })]);
});

// mystmd gives an error node for these, and we don't build error nodes; docs/differences.md covers this
test.each(['```{ }\nBody\n```', '```{note a b}\nBody\n```', '```{note .a.b}\nBody\n```', '```{note #1}\nBody\n```'])(
  '`%s` is a code block here and an error in mystmd',
  (src) => {
    expect(parse(src).children[0].type).toBe('code');
    expect(mystmd(src).children[0].type).toBe('mystDirectiveError');
  },
);

// mystmd has no exact columns, so check positions against the source
test('the directive, its inline options and its argument span their source, with exact columns', () => {
  const src = '> ```{ note .a key="b c" } An arg\n> Body\n> ```';
  const directive = (parse(src).children[0] as any).children[0];
  const [klass, key, arg] = directive.children;
  const span = (node: any) => src.slice(node.position.start.offset, node.position.end.offset);
  expect(span(directive)).toBe(src.slice(2));
  expect(span(klass)).toBe('.a');
  expect(klass.position.start).toEqual({ line: 1, column: 13, offset: 12 });
  expect(span(key)).toBe('key="b c"');
  expect(key.children[0].position.start).toEqual({ line: 1, column: 21, offset: 20 });
  expect(span(arg)).toBe('An arg');
  expect(arg.position.start).toEqual({ line: 1, column: 28, offset: 27 });
});

test('an inline option of a role spans its source', () => {
  const src = 'See { span #a }`x`.';
  const option = (parse(src).children[0] as any).children[1].children[0];
  expect(src.slice(option.position.start.offset, option.position.end.offset)).toBe('#a');
  expect(option.position.start.column).toBe(12);
});
