import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import type { Root } from 'mdast';
import { createTokenizer, tokensToMyst } from 'myst-parser';
import { parse } from '../src/parse.ts';

type Case = { id: string; src: string };

const specPackage = createRequire(import.meta.url).resolve('myst-spec/package.json');
const examples = path.join(path.dirname(specPackage), 'dist', 'examples');

/** Every myst-spec example that has MyST source, with an id like `roles.generic: Basic role` */
export function loadCases(): Case[] {
  return fs
    .readdirSync(examples)
    .filter((file) => file.endsWith('.yml'))
    .flatMap((file) => {
      const { cases } = load(fs.readFileSync(path.join(examples, file), 'utf8')) as {
        cases: { title: string; myst?: string }[];
      };
      return cases
        .filter((c) => c.myst)
        .map((c) => ({ id: `${file.replace('.yml', '')}: ${c.title}`, src: c.myst! }));
    });
}

// The same options as `myst build`: mystmd's defaults (which include smartquotes), plus linkify
const tokenizer = createTokenizer({ markdownit: { linkify: true } });

/** mystmd's parser output, before directives and roles run */
export function mystmd(src: string, options?: { nestBlocks?: boolean }): Root {
  return tokensToMyst(src, tokenizer.parse(src, {}), options) as any;
}

/** Remove differences we don't care about; docs/differences.md says which and why. */
export function normalize(tree: Root): Root {
  const ignore = (key: string, value: unknown) => key === 'position' || key === 'tight' || value === null;
  return JSON.parse(JSON.stringify(tree, (key, value) => (ignore(key, value) ? undefined : value)));
}

/** Compare our tree with mystmd's, for a spec example's source */
export function compare({ src }: Case) {
  const ours = normalize(parse(src));
  const reference = normalize(mystmd(src));
  return { ours, reference, match: isDeepStrictEqual(ours, reference) };
}
