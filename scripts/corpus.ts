// Compare our parser with mystmd's parser on every .md file in a folder of real MyST projects.
//   MYST_CORPUS=<folder> npm run corpus
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { parse } from '../src/parse.ts';
import { mystmd, normalize } from '../test/spec.ts';

const corpus = process.env.MYST_CORPUS;
if (!corpus) {
  console.log('Set MYST_CORPUS to a folder of MyST projects to compare against mystmd.');
  process.exit(0);
}

const files = fs.globSync('**/*.md', {
  cwd: corpus,
  exclude: (name) => /^(\.|_build$)/.test(path.basename(name)),
});
const times = { ours: [] as number[], mystmd: [] as number[] };
const throws = { ours: 0, mystmd: 0 };
let matching = 0;
let linesAgree = 0;
let nodesDisagree = 0;

/** Time one parse, or count a throw */
function timed(name: keyof typeof times, run: () => any) {
  const start = performance.now();
  try {
    const tree = run();
    times[name].push(performance.now() - start);
    return tree;
  } catch {
    throws[name]++;
  }
}

/** Nodes whose start line differs from mystmd's, pairing children by index; markdown-it has no columns */
function lineDisagreements(ours: any, reference: any): number {
  const here = ours.position && reference.position && ours.position.start.line !== reference.position.start.line;
  const a = ours.children ?? [];
  const b = reference.children ?? [];
  let count = here ? 1 : 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) count += lineDisagreements(a[i], b[i]);
  return count;
}

for (const file of files) {
  const src = fs.readFileSync(path.join(corpus, file), 'utf8');
  const ours = timed('ours', () => parse(src));
  const reference = timed('mystmd', () => mystmd(src));
  if (!ours || !reference) continue;
  const match = isDeepStrictEqual(normalize(ours), normalize(reference));
  const disagree = lineDisagreements(ours, reference);
  if (match) matching++;
  if (!disagree) linesAgree++;
  nodesDisagree += disagree;
  if (!match || disagree) console.log(`${file}: ${match ? 'tree matches' : 'tree differs'}, ${disagree} start lines differ`);
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
console.log(`
files parsed            ${files.length}
throws                  ours ${throws.ours}, mystmd ${throws.mystmd}
trees matching          ${matching}
start lines all agree   ${linesAgree}
nodes disagreeing       ${nodesDisagree}
ours total / median     ${sum(times.ours).toFixed(0)} ms / ${median(times.ours).toFixed(2)} ms
mystmd total / median   ${sum(times.mystmd).toFixed(0)} ms / ${median(times.mystmd).toFixed(2)} ms`);
