import { createTokenizer, tokensToMyst } from 'myst-parser';
import { expect, test } from 'vitest';
import { parse } from '../src/parse.ts';
import { normalize } from './spec.ts';

test('nodes have line, column and offset', () => {
  const paragraph = parse('Hello *world*').children[0] as any;
  expect(paragraph.children[1].position).toEqual({
    start: { line: 1, column: 7, offset: 6 },
    end: { line: 1, column: 14, offset: 13 },
  });
});

test('role bodies are parsed in place, with exact positions', () => {
  const role = (parse('> H{sub}`*2*\n> 3`O').children[0] as any).children[0].children[1];
  expect(role).toMatchObject({ type: 'mystRole', name: 'sub', value: '*2*\n3', processed: false });
  expect(role.position.start).toEqual({ line: 1, column: 4, offset: 3 });
  const [emphasis, text] = role.children[0].children;
  expect(emphasis.position.start).toEqual({ line: 1, column: 10, offset: 9 });
  // The body's second line comes after the block quote's `> `
  expect(text).toMatchObject({ value: '\n3', position: { end: { line: 2, column: 4, offset: 16 } } });
});

// The spec only has simple roles, so compare these with mystmd's parser, before roles run
const roles = ['{sub}``a`b``', '{sub}`` a`b ``', '{sub}`a\nb`', '{sub}`*x* **y**`', '{sub}`{sup}``z```', '\\{sub}`2`', '{sub}`2', '{sub} `2`', '{}`x`', '`{sub}`x`', '{sub}`x``'];
const tokenizer = createTokenizer();

test.each(roles)('role syntax matches mystmd: %j', (src) => {
  const reference = tokensToMyst(src, tokenizer.parse(src, {})) as any;
  expect(normalize(parse(src))).toEqual(normalize(reference));
});

test('directive arguments, options and bodies are parsed in place, with exact positions', () => {
  const directive = (parse('> ```{note} An *arg*\n> :class: tip\n>\n> Body *text*\n> ```').children[0] as any).children[0];
  expect(directive).toMatchObject({ type: 'mystDirective', name: 'note', args: 'An *arg*', options: { class: 'tip' } });
  const [arg, option, body] = directive.children;
  expect(arg.children[1].position.start).toEqual({ line: 1, column: 16, offset: 15 });
  expect(option.children[0].position.start).toEqual({ line: 2, column: 11, offset: 31 });
  expect(body).toMatchObject({ value: 'Body *text*' });
  expect(body.children[0].children[1].position.start).toEqual({ line: 4, column: 8, offset: 44 });
});

// The spec only has simple directives, so compare these with mystmd's parser, before directives run
const directives = [
  '~~~{note}\nX\n~~~',
  ':::{note} Arg\n:class: a\n\nBody\n:::',
  '````{a}\n```{b}\nX\n```\n````',
  '::::{a}\n:::{b}\nX\n:::\n::::',
  '```{note}\nunclosed',
  'Para\n```{note}\nX\n```',
  '> ```{note}\n> Hello\n> ```',
  '```{note}\n:class: a\n:class: b\n:flag:\n:x:   \n```',
  '```{note}\n\n\n  Body\n\n```',
  '```{note}\n\n:class: a\n```',
  '```{note}\n```',
  '  ```{note}\n   X\n\n    Y\n  ```',
  '```{code} python\n# not a heading\n```',
];

test.each(directives)('directive syntax matches mystmd: %j', (src) => {
  const reference = tokensToMyst(src, tokenizer.parse(src, {})) as any;
  expect(normalize(parse(src))).toEqual(normalize(reference));
});
