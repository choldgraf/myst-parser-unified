import fs from 'node:fs';
import { expect, test } from 'vitest';
import { compare, loadCases } from './spec.ts';

// Examples that matched when `npm run score` last ran must keep matching
const passing = new Set(JSON.parse(fs.readFileSync('scoreboard.json', 'utf8')) as string[]);
const cases = loadCases().filter((c) => passing.has(c.id));

test('every example in scoreboard.json still exists', () => expect(cases).toHaveLength(passing.size));

test.each(cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
  const { ours, reference } = compare(c);
  expect(ours).toEqual(reference);
});
