import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import type { Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { parse } from '../src/parse.ts';

export type Case = { id: string; src: string; mdast: Root };

const specPackage = createRequire(import.meta.url).resolve('myst-spec/package.json');
const examples = path.join(path.dirname(specPackage), 'dist', 'examples');

/** Every myst-spec example that has MyST source and isn't skipped, with an id like `roles.generic: Basic role` */
export function loadCases(): Case[] {
  return fs
    .readdirSync(examples)
    .filter((file) => file.endsWith('.yml'))
    .flatMap((file) => {
      const { cases } = load(fs.readFileSync(path.join(examples, file), 'utf8')) as {
        cases: { title: string; myst?: string; mdast: Root; skip?: boolean }[];
      };
      return cases
        .filter((c) => c.myst && !c.skip)
        .map((c) => ({ id: `${file.replace('.yml', '')}: ${c.title}`, src: c.myst!, mdast: c.mdast }));
    });
}

/**
 * Remove differences we don't care about (yet).
 * Every rule here is a known difference from the spec, so say why.
 */
export function normalize(tree: Root): Root {
  // JSON round trip: a deep copy that also drops `undefined` fields
  const copy = JSON.parse(JSON.stringify(tree));
  visit(copy, (node: any) => {
    // The spec has no positions, so test/parse.test.ts checks ours
    delete node.position;
    // mdast sets these to null where the spec leaves them out
    if (node.start === null) delete node.start;
    if (node.checked === null) delete node.checked;
  });
  return copy;
}

/** Compare our tree with the mdast that the spec example expects */
export function compare({ src, mdast }: Case) {
  const ours = normalize(parse(src));
  const reference = normalize(mdast);
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
