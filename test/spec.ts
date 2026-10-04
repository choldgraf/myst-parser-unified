import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import type { Root } from 'mdast';
import { createTokenizer, tokensToMyst } from 'myst-parser';
import { parse } from '../src/parse.ts';

export type Case = { id: string; src: string };

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

/**
 * Remove differences we don't care about.
 * mystmd has no columns, so test/parse.test.ts checks our positions.
 * mdast sets empty fields like `title` to null, where mystmd leaves them out.
 * mystmd marks directives with no blank line around them as `tight`, and we don't (yet).
 */
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

/** Where two trees first differ, e.g. `>list>listItem(listItem).spread: false vs true` */
export function firstDifference(ours: any, reference: any, path = ''): string | undefined {
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
