import fs from 'node:fs';
import { expect, test } from 'vitest';
import { compare, compareTransformed, loadCases } from './spec.ts';

// Examples that matched when `npm run score` last ran must keep matching
const scoreboard = JSON.parse(fs.readFileSync('scoreboard.json', 'utf8')) as {
  passing: string[];
  transformed: { passing: string[] };
};
const passing = new Set(scoreboard.passing);
const transformed = new Set(scoreboard.transformed.passing);
const cases = loadCases();

test.each(cases.filter((c) => passing.has(c.id)))('$id', (c) => {
  const { ours, reference } = compare(c);
  expect(ours).toEqual(reference);
});

test.each(cases.filter((c) => transformed.has(c.id)))('after directives and roles: $id', (c) => {
  const { ours, reference } = compareTransformed(c);
  expect(ours).toEqual(reference);
});
