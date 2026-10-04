# myst-parser-unified

A proof of concept for parsing MyST Markdown with [micromark](https://github.com/micromark/micromark), the parser behind remark and unified.

mystmd parses MyST with markdown-it, which records line numbers but not columns ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)), and doesn't fit the unified ecosystem ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).
This repo tests how hard it would be to parse MyST with micromark instead.

To measure that, we parse the MyST in each [`myst-spec`](https://github.com/jupyter-book/mystmd/tree/main/packages/myst-spec/docs/examples) example with our parser and with mystmd's.
An example passes when our [mdast](https://github.com/syntax-tree/mdast) tree is the same as mystmd's, before mystmd runs directives and roles.
The latest scores are in a MyST site in [`docs/`](docs/), and the passing examples are in [`scoreboard.json`](scoreboard.json).

What we've found so far:

- [How the parser works](docs/how-it-works.md), with one micromark extension per MyST construct.
- [Why examples fail](docs/differences.md), as a list of what an adapter from mdast to mystmd's tree shape would need to do.
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

The package is TypeScript, so use it from a bundler or a workspace.
micromark isn't incremental, so this isn't meant for highlighting an editor on every keystroke.

## Run it

You need Node 24 or later, which runs the TypeScript files directly.

- `npm install`: install the dependencies.
- `npm run score`: score every example, and write `scoreboard.json` and the data for the site.
- `npm run score -- "<search>"`: show why the examples whose ID contains `<search>` don't match, like `npm run score -- "roles.html"`.
- `npm test`: check that positions are exact, that syntax edge cases parse like mystmd's parser, and that every example in `scoreboard.json` still passes.
- `npm run docs`: score, then build the site.
- `npm run docs:live`: score, then serve the site locally.
