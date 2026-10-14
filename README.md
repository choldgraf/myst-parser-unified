# myst-parser-unified

A proof of concept for parsing MyST Markdown with [micromark](https://github.com/micromark/micromark), the parser behind remark and unified.

mystmd parses MyST with markdown-it, which records line numbers but not columns ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)).
markdown-it also doesn't fit the unified ecosystem ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).
This repo tests how hard it would be to parse MyST with micromark instead.

To measure that, we parse the MyST in each [`myst-spec`](https://github.com/jupyter-book/mystmd/tree/main/packages/myst-spec/docs/examples) example with our parser and with mystmd's, and compare the two [mdast](https://github.com/syntax-tree/mdast) trees.
The passing examples are in [`scoreboard.json`](scoreboard.json).

**Score: 65 of 90 MyST examples match.**
The 651 CommonMark spec examples are scored separately: 398 of them match.

`toMystmd(tree)` is an optional pass that turns our tree into the shape mystmd's parser builds.
**With `toMystmd`: 83 of 90 MyST examples and 625 of 651 CommonMark examples match.**

We also run mystmd's directives and roles on our tree, and compare the result with each spec example's expected tree.
**After directives and roles: 57 of 90 MyST examples and 420 of 651 CommonMark examples match.**
mystmd's own parser doesn't match all of the spec's trees either, because the spec is older than the parser.

`mystParse` is a drop-in for myst-parser's `mystParse`, and we compare the two, called the same way, on each example: the trees and the messages.
**With `mystParse`: 89 of 90 MyST examples and 625 of 651 CommonMark examples match.**

`npm run score` reproduces these numbers.

We also compare both parsers on 599 `.md` files from real MyST projects: the mystmd, Jupyter Book and 2i2c docs, example-outputs, and three local docs folders.

| Measure | Result |
| --- | --- |
| Files parsed (none threw) | 599 |
| Raw trees matching mystmd's | 157 |
| Trees matching mystmd's with `toMystmd` | 290 |
| Files where every start line agrees with mystmd's | 270 |
| Nodes whose start line differs | 7395 |
| Parse time, ours (total / median per file) | 947 ms / 0.44 ms |
| Parse time, mystmd (total / median per file) | 474 ms / 0.22 ms |

`MYST_CORPUS=<folder> npm run corpus` reproduces these numbers, and does nothing if `MYST_CORPUS` isn't set.
The corpus isn't part of this repo, so CI doesn't run it.
Start lines are compared only where both parsers record a position, because markdown-it records lines but not columns.

## What we found

Every MyST syntax the spec uses, such as roles, directives, targets, comments and block breaks, works as a micromark extension, with exact positions.
No example fails because of how MyST syntax is parsed.
They fail because mystmd's tree isn't plain mdast: it uses curly quotes, sets list `spread` differently, turns bare URLs into links, nests content in `block` nodes, and so on.
`toMystmd` fixes most of those, but not curly quotes or bare URLs; [the differences page](docs/differences.md) lists them.
The CommonMark score mostly measures where markdown-it and micromark differ.

The docs cover:

- [How the parser works](docs/how-it-works.md): one micromark extension per MyST syntax.
- [What we learned](docs/findings.md): what this parser found, and what blocks mystmd from switching.
- [Why examples fail](docs/differences.md): what `toMystmd` changes, and what it can't.
- [What was hard about micromark](docs/how-it-works.md#notes-on-micromark).

## Use it

`parse(src)` returns an mdast tree, and the `remarkMyst` plugin adds the same MyST syntax to remark.
`toMystmd(tree)` changes a tree, in place, into mystmd's shape:

```js
import { parse, remarkMyst, toMystmd } from 'myst-parser-unified';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const tree = parse(src);
const sameTree = unified().use(remarkParse).use(remarkMyst).parse(src);
const mystmdTree = toMystmd(parse(src));
```

`mystParse` from `myst-parser-unified/mystmd` takes myst-parser's `directives`, `roles`, `vfile` and `markdownit` options, returns the same tree as myst-parser's `mystParse`, and writes the same messages to `vfile`:

```js
import { mystParse } from 'myst-parser-unified/mystmd';

const tree = mystParse(src, { directives, roles, vfile, markdownit: { linkify: true } });
```

It runs mystmd's directives and roles, which aren't part of myst-parser's public API.
So it needs `myst-parser` installed at exactly 1.7.4, a peer dependency: other versions may move or change the files it loads.
It only runs in Node, and the main entry doesn't need `myst-parser`.
[The differences page](docs/differences.md#mystparse) says what it doesn't do the same.

It isn't on npm, so install it with `npm install github:choldgraf/myst-parser-unified`.
Installing it builds the JavaScript in `dist/` with `npm run build`.
micromark isn't incremental, so this isn't meant for highlighting an editor on every keystroke.
It can't turn a tree back into MyST yet: there are no `mdast-util-to-markdown` extensions, so `remark-stringify` doesn't know the MyST nodes.

## Run it

You need Node 24 or later, which runs the TypeScript files directly.

- `npm install`: install the dependencies.
- `npm run score`: score every example, and write `scoreboard.json` and the data for the site.
- `npm run score -- "<search>"`: show why the first three examples whose ID contains `<search>` don't match mystmd's tree, without `toMystmd`, like `npm run score -- "directives.figure"`.
- `MYST_CORPUS=<folder> npm run corpus`: compare both parsers on every `.md` file in a folder of MyST projects.
- `npm test`: check that positions are exact, that syntax edge cases parse like mystmd's parser, that `mystParse` writes the same messages as mystmd's, and that every example in `scoreboard.json` still passes.
- `npm run typecheck`: check the types with TypeScript.
- `npm run build`: write JavaScript and type declarations to `dist/`.
- `npm run docs`: score, then build the [docs site](https://chrisholdgraf.com/myst-parser-unified/).
- `npm run docs:live`: score, then serve the site locally.

## What must stay in sync by hand

Nothing checks these, so change both sides together:

- The citation regexes in `src/citations.ts`, copied from `markdown-it-myst/dist/citations.js`.
- The label characters in `src/blocks.ts`, from mystmd's `TARGET_PATTERN`.
- The math rules in `src/math.ts`, from `markdown-it-dollarmath`, `markdown-it-amsmath` and `myst-common`'s `normalizeLabel`.
- The characters inside braces in `src/shared.ts`, from `markdown-it-myst/dist/inlineAttributes.js`.
- The options and `myst-ext-*` extensions in `test/spec.ts` and `package.json`, from mystmd-client's `parse.ts`.
- The scorer names in `test/spec.ts` and `scripts/score.ts`, and the columns in `docs/index.md` and `scoreboard.json`.
- The numbers in this README, `docs/differences.md` and `docs/findings.md`, from `npm run score` and `npm run corpus`; CI checks only `scoreboard.json`.
- The `myst-parser` 1.7.4 pin in `package.json` (peer and dev), in this README, and the `dist/` paths in `src/mystParse.ts`.
- The mdast node types in `src/parse.ts`, and the nodes each `*FromMarkdown` builds.
- The syntax list in `docs/how-it-works.md`, and the `syntaxes` array in `src/parse.ts`.
