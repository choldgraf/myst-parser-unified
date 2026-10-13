import fs from 'node:fs';
import { expect, test } from 'vitest';
import { compare, loadCases } from './spec.ts';

// Examples that matched when `npm run score` last ran must keep matching
const passing = new Set((JSON.parse(fs.readFileSync('scoreboard.json', 'utf8')) as { passing: string[] }).passing);
const cases = loadCases().filter((c) => passing.has(c.id));

test.each(cases)('$id', (c) => {
  const { ours, reference } = compare(c);
  expect(ours).toEqual(reference);
});
