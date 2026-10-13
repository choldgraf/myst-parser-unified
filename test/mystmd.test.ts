import { expect, test } from 'vitest';
import { parse, toMystmd } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// One source per difference that toMystmd handles; docs/differences.md describes each
const cases = {
  'code lang and meta': '```\na\n```\n\n```js title="b"\nc\n```',
  'front matter': '---\ntitle: A\n---\n\nB',
  'list spread': '- a\n- b\n\n- c\n\n1. d',
  'table align and header': '| a | b | c |\n| :- | -: | - |\n| d | e | f |',
  'images out of paragraphs': '![a](b.png)\n\n> ![c](d.png)\n\n![e](f.png) g',
  'blocks': 'a\n\n+++ {"b": 1}\n\nc\n\nd\n\n+++\n\n+++\ne',
  'URL encoding': '[a](/föö?b=\\\\*&c=%20 "d") ![e](<f g.png>)',
  'resolved references': '[a][B] [b] ![c][b]\n\n> [B]: /url "title"\n\n[b]: /other',
};

test.each(Object.entries(cases))('%s', (_, src) => {
  expect(normalize(toMystmd(parse(src)))).toEqual(normalize(mystmd(src)));
});

test('a block spans its +++ and its content', () => {
  const [, block] = toMystmd(parse(cases.blocks)).children as any[];
  expect(block.position.start.offset).toBe(3);
  expect(block.position.end).toEqual(block.children.at(-1).position.end);
});

test('every node keeps a position', () => {
  const missing: string[] = [];
  const check = (node: any) => {
    if (!node.position) missing.push(node.type);
    node.children?.forEach(check);
  };
  Object.values(cases).forEach((src) => check(toMystmd(parse(src))));
  expect(missing).toEqual([]);
});
