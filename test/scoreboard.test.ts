import fs from 'node:fs';
import { expect, test } from 'vitest';
import { loadCases, scorers } from './spec.ts';

// Examples that matched when `npm run score` last ran must keep matching
const scoreboard = JSON.parse(fs.readFileSync('scoreboard.json', 'utf8')) as Record<string, { passing: string[] }>;
const cases = loadCases();

for (const [name, score] of Object.entries(scorers)) {
  const passing = new Set(scoreboard[name].passing);
  test.each(cases.filter((c) => passing.has(c.id)))(`${name}: $id`, (c) => {
    const { ours, reference } = score(c);
    expect(ours).toEqual(reference);
  });
}
