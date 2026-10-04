# myst-parser-unified

A proof of concept for parsing MyST Markdown with [micromark](https://github.com/micromark/micromark), the parser behind remark and unified.

mystmd parses MyST with markdown-it, which records line numbers but not columns ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)), and doesn't fit the unified ecosystem ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).
This repo tests how hard it would be to parse MyST with micromark instead.

To measure that, we use the examples in [`myst-spec`](https://github.com/jupyter-book/mystmd/tree/main/packages/myst-spec/docs/examples).
Each example is a bit of MyST and the [mdast](https://github.com/syntax-tree/mdast) tree it should parse to.
An example passes when our tree is the same as the example's.
The latest scores are in a MyST site in [`docs/`](docs/), and the passing examples are in [`scoreboard.json`](scoreboard.json).

What we've found so far:

- [How the parser works](docs/how-it-works.md), with one micromark extension per MyST construct.
- [Why examples fail](docs/differences.md), which is mostly because the spec's trees follow markdown-it, not mdast.
- [What isn't supported yet](docs/how-it-works.md#not-supported-yet), with an effort estimate for each.
- [What was hard about micromark](docs/how-it-works.md#notes-on-micromark).

## Use it

`parse(src)` from the package root returns an mdast tree.
To add MyST syntax to your own micromark setup instead, import a syntax's micromark and mdast extensions from `myst-parser-unified/roles`, `/directives` or `/blocks`.
They're TypeScript, so use them from a bundler or a workspace.

## Run it

You need Node 24 or later, which runs the TypeScript files directly.

- `npm install`: install the dependencies.
- `npm run score`: score every example, and write `scoreboard.json` and the data for the site.
- `npm run score -- "<search>"`: show why the examples whose ID contains `<search>` don't match, like `npm run score -- "roles.html"`.
- `npm test`: check that positions are exact, that syntax edge cases parse like mystmd's parser, and that every example in `scoreboard.json` still passes.
- `npm run docs`: score, then build the site.
- `npm run docs:live`: score, then serve the site locally.
