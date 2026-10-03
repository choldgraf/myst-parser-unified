import { expect, test } from 'vitest';
import { parse } from '../src/parse.ts';

test('nodes have line, column and offset', () => {
  const paragraph = parse('Hello *world*').children[0] as any;
  expect(paragraph.children[1].position).toEqual({
    start: { line: 1, column: 7, offset: 6 },
    end: { line: 1, column: 14, offset: 13 },
  });
});
