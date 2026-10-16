# myst-parser-unified

A proof of concept for parsing MyST Markdown with [micromark](https://github.com/micromark/micromark), the parser behind remark and unified.

mystmd parses MyST with markdown-it, which [records line numbers but not columns](https://github.com/jupyter-book/mystmd/issues/2864).
markdown-it also [doesn't fit the unified ecosystem](https://github.com/jupyter-book/mystmd/issues/1705).
This repo tests how hard it would be to parse MyST with micromark instead.

To measure that, we parse the MyST in each [`myst-spec`](https://github.com/jupyter-book/mystmd/tree/main/packages/myst-spec/docs/examples) example with our parser and with mystmd's, and compare the two [mdast](https://github.com/syntax-tree/mdast) trees.
The passing examples are in [`scoreboard.json`](scoreboard.json).

**Score: 65 of 90 MyST examples match** mystmd's tree straight from the parser, from `npm run score`.
[Score per file](docs/index.md#score-per-file) has the other scores, and [What we learned](docs/findings.md#measured-results) has a comparison on real MyST projects.

## What we found

Every MyST syntax the spec uses, such as roles, directives, targets, comments and block breaks, works as a micromark extension, with exact positions.
No example fails because of how MyST syntax is parsed.
They fail because mystmd's tree isn't plain mdast: it uses curly quotes, sets list `spread` differently, turns bare URLs into links, nests content in `block` nodes, and so on.
`toMystmd` fixes most of those, but not curly quotes or bare URLs.
[The differences page](docs/differences.md) lists them.
myst-spec also includes the CommonMark spec examples, scored separately, and those mostly measure where markdown-it and micromark differ.

## Use it

It isn't on npm, so install it with `npm install github:choldgraf/myst-parser-unified`.
`npm install` runs the build for you.

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

`mystParse` from `myst-parser-unified/mystmd` is a drop-in for myst-parser's `mystParse`.
It takes the same `directives`, `roles`, `vfile` and `markdownit` options, returns the same tree, and writes the same messages to `vfile`:

```js
import { mystParse } from 'myst-parser-unified/mystmd';

const tree = mystParse(src, { directives, roles, vfile, markdownit: { linkify: true } });
```

It runs mystmd's own directives and roles, so it needs the `myst-parser` version pinned in `package.json` as a peer dependency, and it only runs in Node.
The main entry doesn't need `myst-parser`.
[The differences page](docs/differences.md#mystparse) says what it doesn't do the same.

micromark isn't incremental, so this isn't meant for highlighting an editor on every keystroke.
It can't turn a tree back into MyST yet: there are no `mdast-util-to-markdown` extensions, so `remark-stringify` doesn't know the MyST nodes.

## Run it

You need Node 24 or later, which runs the TypeScript files directly.

- `npm install`: install the dependencies.
- `npm run score`: score every example, and write `scoreboard.json` and the data for the site.
- `npm run score -- "directives.figure"`: show why the first three examples whose ID contains that text don't match mystmd's tree.
  This compares the raw tree, before `toMystmd`.
- `MYST_CORPUS=<folder> npm run corpus`: compare both parsers on every `.md` file in a folder of MyST projects.
- `npm test`: run the tests.
- `npm run typecheck`: check the types with TypeScript.
- `npm run build`: write JavaScript and type declarations to `dist/`.
- `npm run docs`: score, then build the [docs site](https://chrisholdgraf.com/myst-parser-unified/).
- `npm run docs:live`: score, then serve the site locally.
