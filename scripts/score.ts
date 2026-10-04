// Compare our parser with mystmd's parser on every myst-spec example.
//   npm run score                 score per file, and update scoreboard.json and docs/data/
//   npm run score -- "<search>"   show why examples whose id contains <search> don't match
import assert from 'node:assert';
import fs from 'node:fs';
import { compare, firstDifference, loadCases } from '../test/spec.ts';

const search = process.argv[2];
const cases = loadCases();

if (search !== undefined) {
  const failing = cases
    .filter((c) => c.id.includes(search))
    .map((c) => ({ ...c, ...compare(c) }))
    .filter((c) => !c.match);
  for (const { id, src, ours, reference } of failing.slice(0, 3)) {
    try {
      assert.deepStrictEqual(ours, reference);
    } catch (error) {
      console.log(`## ${id}\n\n${src}\n${(error as Error).message}\n`);
    }
  }
  console.log(`${failing.length} failing examples match "${search}"`);
} else {
  const passing: string[] = [];
  const byFile = new Map<string, { pass: number; total: number }>();
  // Failing examples, grouped by where they first differ (quoted values and child counts removed)
  const differences = new Map<string, { count: number; example: string }>();
  for (const c of cases) {
    const { id } = c;
    const file = id.split(':')[0];
    const counts = byFile.get(file) ?? { pass: 0, total: 0 };
    counts.total++;
    const { ours, reference, match } = compare(c);
    if (match) {
      counts.pass++;
      passing.push(id);
    } else {
      const signature = firstDifference(ours, reference)!
        .replace(/"(?:[^"\\]|\\.)*"/g, '"…"')
        .replace(/\d+ vs \d+ children/, 'N vs M children');
      const group = differences.get(signature) ?? { count: 0, example: id };
      group.count++;
      differences.set(signature, group);
    }
    byFile.set(file, counts);
  }
  for (const [file, { pass, total }] of byFile) console.log(`${file.padEnd(36)} ${pass}/${total}`);
  console.log(`\nTOTAL ${passing.length}/${cases.length}`);
  fs.writeFileSync('scoreboard.json', JSON.stringify(passing, null, 2) + '\n');

  // Data for the docs site: myst-listing needs a `title` on every item
  const files = [...byFile].map(([title, counts]) => ({ title, ...counts }));
  files.push({ title: 'TOTAL', pass: passing.length, total: cases.length });
  const groups = [...differences].map(([title, group]) => ({ title, ...group }));
  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync('docs/data/files.json', JSON.stringify(files, null, 2) + '\n');
  fs.writeFileSync('docs/data/differences.json', JSON.stringify(groups, null, 2) + '\n');
}
