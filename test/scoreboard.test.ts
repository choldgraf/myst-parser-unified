import fs from 'node:fs';
import { expect, test } from 'vitest';
import { compare, loadCases } from './spec.ts';

// Examples that matched when `npm run score` last ran must keep matching
const passing = new Set(JSON.parse(fs.readFileSync('scoreboard.json', 'utf8')) as string[]);
const cases = loadCases().filter((c) => passing.has(c.id));

test.each(cases.map((c) => [c.id, c.src]))('%s', (_, src) => {
  const { ours, reference } = compare(src);
  expect(ours).toEqual(reference);
});
