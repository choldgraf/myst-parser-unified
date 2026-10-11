import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { expect, test } from 'vitest';
import { parse, remarkMyst } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

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

test('directive arguments, options and bodies are parsed in place, with exact positions', () => {
  const directive = (parse('> ```{note} An *arg*\n> :class: tip\n>\n> Body *text*\n> ```').children[0] as any).children[0];
  expect(directive).toMatchObject({ type: 'mystDirective', name: 'note', args: 'An *arg*', options: { class: 'tip' } });
  const [arg, option, body] = directive.children;
  expect(arg.children[1].position.start).toEqual({ line: 1, column: 16, offset: 15 });
  expect(option.children[0].position.start).toEqual({ line: 2, column: 11, offset: 31 });
  expect(body).toMatchObject({ value: 'Body *text*' });
  expect(body.children[0].children[1].position.start).toEqual({ line: 4, column: 8, offset: 44 });
});

test('remarkMyst parses like parse', () => {
  const src = '(x)=\n```{note} An *arg*\n:class: tip\n\nH{sub}`2`O\n```';
  expect(unified().use(remarkParse).use(remarkMyst).parse(src)).toEqual(parse(src));
});

// The spec only has simple MyST syntax, so compare these edge cases with mystmd's parser,
// before directives and roles run
const syntax = [
  // Roles
  '{sub}``a`b``',
  '{sub}`` a`b ``',
  '{sub}`a\nb`',
  '{sub}`*x* **y**`',
  '{sub}`{sup}``z```',
  '\\{sub}`2`',
  '{sub}`2',
  '{sub} `2`',
  '{}`x`',
  '`{sub}`x`',
  '{sub}`x``',
  // Directives
  '~~~{note}\nX\n~~~',
  ':::{note} Arg\n:class: a\n\nBody\n:::',
  '````{a}\n```{b}\nX\n```\n````',
  '::::{a}\n:::{b}\nX\n:::\n::::',
  '```{note}\nunclosed',
  '```{note}\n',
  '```{a}\n```{b}\n```\nx',
  'Para\n```{note}\nX\n```',
  '> ```{note}\n> Hello\n> ```',
  '```{note}\n:class: a\n:class: b\n:flag:\n:x:   \n```',
  '```{note}\n\n\n  Body\n\n```',
  '```{note}\n\n:class: a\n```',
  '```{note}\n```',
  '  ```{note}\n   X\n\n    Y\n  ```',
  '```{code} python\n# not a heading\n```',
  // Targets, comments and block breaks
  '% hi  \n%there\nPara',
  '% a\n\n% b',
  'x\n% c\n  % d\ny',
  '> % q\n> (t)=\n> +++',
  'Para\n+++ {"a": 1}\nNext',
  '++ +x',
  '++',
  '(my-label)=\n# H',
  'Para\n(x)=  ',
  '(bad label)=',
  '(x)= y',
];

test.each(syntax)('syntax matches mystmd: %j', (src) => {
  // mystmd puts the content between block breaks in `block` nodes, which docs/differences.md covers
  expect(normalize(parse(src))).toEqual(normalize(mystmd(src, { nestBlocks: false })));
});

// docs/how-it-works.md covers this difference
test('`+ + +` is a list here, and a block break in mystmd', () => {
  expect(parse('+ + +').children[0].type).toBe('list');
  expect(mystmd('+ + +', { nestBlocks: false }).children[0].type).toBe('blockBreak');
});
