// Compare our parser with mystmd's parser on every myst-spec example.
//   npm run score                 score per file, and update scoreboard.json and docs/data/
//   npm run score -- "<search>"   show why the first three examples whose id contains <search> don't match
import assert from 'node:assert';
import fs from 'node:fs';
import { compare, loadCases } from '../test/spec.ts';

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
  const totals = { myst: { pass: 0, total: 0 }, commonmark: { pass: 0, total: 0 } };
  const byFile = new Map<string, { pass: number; total: number }>();
  // Failing examples, grouped by where they first differ (quoted values and child counts removed)
  const differences = new Map<string, { count: number; example: string }>();
  for (const c of cases) {
    const { id } = c;
    const file = id.split(':')[0];
    // The CommonMark spec is one file, and every other file is MyST's own examples
    const section = file.startsWith('cmark_spec') ? totals.commonmark : totals.myst;
    section.total++;
    const counts = byFile.get(file) ?? { pass: 0, total: 0 };
    counts.total++;
    const { ours, reference, match } = compare(c);
    if (match) {
      counts.pass++;
      section.pass++;
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
  console.log(`\nMyST ${totals.myst.pass}/${totals.myst.total}`);
  console.log(`CommonMark ${totals.commonmark.pass}/${totals.commonmark.total}`);
  console.log(`TOTAL ${passing.length}/${cases.length}`);
  fs.writeFileSync('scoreboard.json', JSON.stringify({ ...totals, passing }, null, 2) + '\n');

  // Data for the docs site: myst-listing needs a `title` on every item
  const files = [...byFile].map(([title, counts]) => ({ title, ...counts }));
  files.push(
    { title: 'MyST', ...totals.myst },
    { title: 'CommonMark', ...totals.commonmark },
    { title: 'TOTAL', pass: passing.length, total: cases.length },
  );
  const groups = [...differences].map(([title, group]) => ({ title, ...group }));
  fs.mkdirSync('docs/data', { recursive: true });
  fs.writeFileSync('docs/data/files.json', JSON.stringify(files, null, 2) + '\n');
  fs.writeFileSync('docs/data/differences.json', JSON.stringify(groups, null, 2) + '\n');
}

/** Where two trees first differ, e.g. `>list>listItem(listItem).spread: false vs true` */
function firstDifference(ours: any, reference: any, path = ''): string | undefined {
  const show = (value: unknown) =>
    JSON.stringify(typeof value === 'string' && value.length > 40 ? value.slice(0, 40) + '…' : value);
  if (typeof ours !== 'object' || ours === null || typeof reference !== 'object' || reference === null) {
    return ours === reference ? undefined : `${path}: ${show(ours)} vs ${show(reference)}`;
  }
  if (ours.type !== reference.type) return `${path}: type ${ours.type} vs ${reference.type}`;
  const here = ours.type ? `${path}(${ours.type})` : path;
  for (const key of new Set([...Object.keys(ours), ...Object.keys(reference)])) {
    if (key === 'children') continue;
    if (!(key in ours)) return `${here}.${key}: missing in ours`;
    if (!(key in reference)) return `${here}.${key}: extra in ours`;
    const difference = firstDifference(ours[key], reference[key], `${here}.${key}`);
    if (difference) return difference;
  }
  const a = ours.children ?? [];
  const b = reference.children ?? [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const difference = firstDifference(a[i], b[i], `${path}>${a[i].type}`);
    if (difference) return difference;
  }
  if (a.length !== b.length) return `${here}: ${a.length} vs ${b.length} children`;
}
