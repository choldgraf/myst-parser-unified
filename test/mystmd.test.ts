import { expect, test } from 'vitest';
import { parse, toMystmd } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// One source per difference that toMystmd handles; docs/differences.md describes each
const cases = {
  'code lang and meta': '```\na\n```\n\n```js title="b"\nc\n```',
};

test.each(Object.entries(cases))('%s', (_, src) => {
  expect(normalize(toMystmd(parse(src)))).toEqual(normalize(mystmd(src)));
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
