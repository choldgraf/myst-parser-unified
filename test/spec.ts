import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import type { Root } from 'mdast';
import { createTokenizer, defaultOptions, tokensToMyst } from 'myst-parser';
// applyDirectives and applyRoles aren't exported from myst-parser's main entry,
// so package.json pins myst-parser to the exact version whose dist/ we import from.
import { applyDirectives } from '../node_modules/myst-parser/dist/directives.js';
import { applyRoles } from '../node_modules/myst-parser/dist/roles.js';
import { VFile } from 'vfile';
import { parse, toMystmd } from '../src/parse.ts';

type Case = { id: string; src: string; mdast: Root };

const specPackage = createRequire(import.meta.url).resolve('myst-spec/package.json');
const examples = path.join(path.dirname(specPackage), 'dist', 'examples');

/** Every myst-spec example that has MyST source, with an id like `roles.generic: Basic role`, and its expected tree */
export function loadCases(): Case[] {
  return fs
    .readdirSync(examples)
    .filter((file) => file.endsWith('.yml'))
    .flatMap((file) => {
      const { cases } = load(fs.readFileSync(path.join(examples, file), 'utf8')) as {
        cases: { title: string; myst?: string; mdast: Root }[];
      };
      return cases
        .filter((c) => c.myst)
        .map((c) => ({ id: `${file.replace('.yml', '')}: ${c.title}`, src: c.myst!, mdast: c.mdast }));
    });
}

// The same options as `myst build`: mystmd's defaults (which include smartquotes), plus linkify
const tokenizer = createTokenizer({ markdownit: { linkify: true } });

/** mystmd's parser output, before directives and roles run */
export function mystmd(src: string, options?: { nestBlocks?: boolean }): Root {
  const tree = tokensToMyst(src, tokenizer.parse(src, {}), options) as any;
  // A directive's nested parse turns on markdown-it's replacements, like `--` to `–`, for every later parse.
  // `myst build` makes a tokenizer per file, so it never gets to replace anything.
  tokenizer.disable('replacements');
  return tree;
}

/** Our tree after mystmd's directives and roles run, like mystmd's `mystParse` */
export function transformed(src: string): Root {
  const tree = parse(src) as any;
  // myst-parser's types want vfile@5; vfile@6 records its warnings the same way
  const vfile = new VFile() as any;
  applyDirectives(tree, defaultOptions.directives, vfile, {
    // Parse a directive's nested content, with line numbers shifted to where it sits in the file
    parseMyst: (source, lineOffset = 0) => {
      const nested = transformed(source) as any;
      const shift = (node: any) => {
        if (node.position) {
          node.position.start.line += lineOffset;
          node.position.end.line += lineOffset;
        }
        node.children?.forEach(shift);
      };
      shift(nested);
      return nested;
    },
  });
  applyRoles(tree, defaultOptions.roles, vfile);
  return tree;
}

/** Remove differences we don't care about; docs/differences.md says which and why. */
export function normalize(tree: Root): Root {
  const ignore = (key: string, value: unknown) => key === 'position' || key === 'tight' || value === null;
  return JSON.parse(JSON.stringify(tree, (key, value) => (ignore(key, value) ? undefined : value)));
}

/** Compare our tree, after `adapt` if given, with mystmd's, for a spec example's source */
export function compare({ src }: Case, adapt = (tree: Root) => tree) {
  const ours = normalize(adapt(parse(src)));
  const reference = normalize(mystmd(src));
  return { ours, reference, match: isDeepStrictEqual(ours, reference) };
}

/** Compare our tree, after directives and roles run, with the spec's expected tree */
export function compareTransformed({ src, mdast }: Case) {
  const ours = normalize(transformed(src));
  const reference = normalize(mdast);
  return { ours, reference, match: isDeepStrictEqual(ours, reference) };
}

/** The scores: our tree, raw and after `toMystmd`, against mystmd's; and after directives and roles, against the spec's */
export const scorers = {
  raw: (c: Case) => compare(c),
  adapted: (c: Case) => compare(c, toMystmd),
  transformed: compareTransformed,
};
