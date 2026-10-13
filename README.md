# myst-parser-unified

A proof of concept for parsing MyST Markdown with [micromark](https://github.com/micromark/micromark), the parser behind remark and unified.

mystmd parses MyST with markdown-it, which records line numbers but not columns ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)).
markdown-it also doesn't fit the unified ecosystem ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).
This repo tests how hard it would be to parse MyST with micromark instead.

To measure that, we parse the MyST in each [`myst-spec`](https://github.com/jupyter-book/mystmd/tree/main/packages/myst-spec/docs/examples) example with our parser and with mystmd's, and compare the two [mdast](https://github.com/syntax-tree/mdast) trees.
The passing examples are in [`scoreboard.json`](scoreboard.json).

**Score: 63 of 90 MyST examples match.**
The 651 CommonMark spec examples are scored separately: 397 of them match.

We also run mystmd's directives and roles on our tree, and compare the result with each spec example's expected tree.
**After directives and roles: 57 of 90 MyST examples and 421 of 651 CommonMark examples match.**
mystmd's own parser doesn't match all of the spec's trees either, because the spec is older than the parser.

`npm run score` reproduces these numbers.

We also compare both parsers on 599 `.md` files from real MyST projects: the mystmd, Jupyter Book and 2i2c docs, example-outputs, and three local docs folders.

| Measure | Result |
| --- | --- |
| Files parsed (none threw) | 599 |
| Raw trees matching mystmd's | 130 |
| Files where every start line agrees with mystmd's | 270 |
| Nodes whose start line differs | 8068 |
| Parse time, ours (total / median per file) | 1004 ms / 0.45 ms |
| Parse time, mystmd (total / median per file) | 523 ms / 0.24 ms |

`MYST_CORPUS=<folder> npm run corpus` reproduces these numbers, and does nothing if `MYST_CORPUS` isn't set.
The corpus isn't part of this repo, so CI doesn't run it.
Start lines are compared only where both parsers record a position, because markdown-it records lines but not columns.

## What we found

Every MyST syntax the spec uses, such as roles, directives, targets, comments and block breaks, works as a micromark extension, with exact positions.
No example fails because of how MyST syntax is parsed.
They fail because mystmd's tree isn't plain mdast: it uses curly quotes, sets list `spread` differently, turns bare URLs into links, nests content in `block` nodes, and so on.
An adapter from mdast to mystmd's tree could fix those; [the differences page](docs/differences.md) lists them.
The CommonMark score mostly measures where markdown-it and micromark differ.

The docs cover:

- [How the parser works](docs/how-it-works.md): one micromark extension per MyST syntax.
- [Why examples fail](docs/differences.md): what an adapter from mdast to mystmd's tree would change.
- [What isn't supported yet](docs/how-it-works.md#not-supported-yet), with an effort estimate for each.
- [What was hard about micromark](docs/how-it-works.md#notes-on-micromark).

## Use it

`parse(src)` returns an mdast tree, and the `remarkMyst` plugin adds the same MyST syntax to remark:

```js
import { parse, remarkMyst } from 'myst-parser-unified';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const tree = parse(src);
const sameTree = unified().use(remarkParse).use(remarkMyst).parse(src);
```

It isn't on npm, so install it with `npm install github:choldgraf/myst-parser-unified`.
It's written in TypeScript, and Node won't run TypeScript from `node_modules`.
So use it from a bundler or a workspace.
micromark isn't incremental, so this isn't meant for highlighting an editor on every keystroke.
It can't turn a tree back into MyST yet: there are no `mdast-util-to-markdown` extensions, so `remark-stringify` doesn't know the MyST nodes.

## Run it

You need Node 24 or later, which runs the TypeScript files directly.

- `npm install`: install the dependencies.
- `npm run score`: score every example, and write `scoreboard.json` and the data for the site.
- `npm run score -- "<search>"`: show why the first three examples whose ID contains `<search>` don't match, like `npm run score -- "directives.figure"`.
- `MYST_CORPUS=<folder> npm run corpus`: compare both parsers on every `.md` file in a folder of MyST projects.
- `npm test`: check that positions are exact, that syntax edge cases parse like mystmd's parser, and that every example in `scoreboard.json` still passes.
- `npm run typecheck`: check the types with TypeScript.
- `npm run docs`: score, then build the [docs site](https://chrisholdgraf.com/myst-parser-unified/).
- `npm run docs:live`: score, then serve the site locally.
