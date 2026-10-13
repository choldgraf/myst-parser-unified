import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { isDeepStrictEqual } from 'node:util';
import { load } from 'js-yaml';
import type { Root } from 'mdast';
import { createTokenizer, mystParse as mystmdParse, tokensToMyst } from 'myst-parser';
import { buttonRole } from 'myst-ext-button';
import { cardDirective } from 'myst-ext-card';
import { exerciseDirectives } from 'myst-ext-exercise';
import { gridDirectives } from 'myst-ext-grid';
import { proofDirective } from 'myst-ext-proof';
import { tabDirectives } from 'myst-ext-tabs';
import { VFile } from 'vfile';
import { applyDirectivesAndRoles, mystParse } from '../src/mystParse.ts';
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

/** Our tree after mystmd's directives and roles run */
export function transformed(src: string): Root {
  return applyDirectivesAndRoles(parse(src), transformed);
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

// The options mystmd-client passes to `mystParse`: the extensions `myst build` turns on, plus linkify
const extensions = {
  markdownit: { linkify: true },
  directives: [cardDirective, ...gridDirectives, ...tabDirectives, proofDirective, ...exerciseDirectives],
  roles: [buttonRole],
};

/** What an editor shows for each message: its text, line, rule and whether it's an error */
const messages = (vfile: VFile) => vfile.messages.map(({ reason, line, ruleId, fatal }) => ({ reason, line, ruleId, fatal }));

/** Compare our `mystParse` with myst-parser's, called the same way: the trees and the messages */
export function compareDropin({ src }: { src: string }) {
  const parseWith = (parser: typeof mystParse) => {
    const vfile = new VFile();
    // myst-parser's types want vfile@5; vfile@6 records its messages the same way
    const tree = normalize(parser(src, { ...extensions, vfile: vfile as any }));
    return { tree, messages: messages(vfile) };
  };
  const ours = parseWith(mystParse);
  const reference = parseWith(mystmdParse as typeof mystParse);
  return { ours, reference, match: isDeepStrictEqual(ours, reference) };
}

/** The scores: our tree, raw and after `toMystmd`, against mystmd's; after directives and roles, against the spec's; and our `mystParse` against mystmd's */
export const scorers = {
  raw: (c: Case) => compare(c),
  adapted: (c: Case) => compare(c, toMystmd),
  transformed: compareTransformed,
  dropin: compareDropin,
};
