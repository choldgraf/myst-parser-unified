import { createRequire } from 'node:module';
import { mystParse as mystmdParse } from 'myst-parser';
import { expect, test } from 'vitest';
import { mystParse } from '../src/mystParse.ts';
import { compareDropin } from './spec.ts';

// myst-parser's own vfile@5, to check what happens when a caller passes one. This repo's vfile is 6.
// It's required from myst-parser's folder, like src/mystParse.ts does, and typed as vfile@6, which has the same messages.
const { VFile: VFile5 }: typeof import('vfile') = createRequire(createRequire(import.meta.url).resolve('myst-parser'))('vfile');

// Each source makes mystmd write at least one message
const cases = {
  'a known directive with option errors': '```{code-block} python\n:lineno-start: abc\n:foo: bar\nx = 1\n```',
  'an unknown directive': 'Text\n\n```{abc} arg\n:x: y\nbody\n```',
  'an unknown role': 'A {abc}`x` role',
  'a nested directive': '::::{note}\n:::{warning}\nx {abc}`y`\n:::\n::::',
  'a role inside a directive body': 'Intro\n\n```{note}\nA {sub}`2` and {abc}`y`\n\n{xyz}`z`\n```',
  'a list-table, which parses each cell again': '```{list-table}\n:header-rows: 1\n* - a\n  - {abc}`b`\n```',
};

test.each(Object.entries(cases))('%s: same tree and messages as mystmd', (_, src) => {
  const { ours, reference } = compareDropin({ src });
  expect(reference.messages).not.toEqual([]);
  expect(ours).toEqual(reference);
});

test('a vfile@5 gets the same messages as with mystmd', () => {
  const [ours, reference] = [mystParse, mystmdParse].map((parser) => {
    const vfile = new VFile5();
    parser(cases['a role inside a directive body'], { vfile: vfile as any });
    return vfile.messages.map(({ reason, line, column }) => ({ reason, line, column }));
  });
  expect(ours).toEqual(reference);
});
