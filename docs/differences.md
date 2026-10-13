# Differences from mystmd

An example passes when our tree is the same as the one mystmd's own parser builds from the example's source.
Our tree is standard [mdast](https://github.com/syntax-tree/mdast).
mystmd's parser also runs a few extra passes, like smartquotes and resolving references.
So each difference below is something an adapter from mdast to mystmd's shape would need to do.
This parser keeps emitting mdast.
Whether mystmd wants the adapter is mystmd's call.

## How examples are compared

[`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) parses each myst-spec example's source with our parser and with mystmd's `tokensToMyst`, and compares the two trees.
Both trees are from before directives and roles run, so they have generic `mystDirective` and `mystRole` nodes.
We run mystmd's parser with `myst build`'s options: mystmd's defaults, which include smartquotes, plus linkify.

`normalize()` ignores:

- Positions, because mystmd's nodes have line numbers but no columns.
- Fields that mdast sets to `null`, which mystmd leaves out.
- `tight`, which mystmd sets on directives with no blank line around them.

[`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts) compares MyST syntax edge cases with mystmd in the same way.

A second score runs mystmd's `applyDirectives` and `applyRoles` on our tree, and compares it with the spec's expected tree, with the same `normalize()`.
Some of the spec's trees are older than mystmd's parser, so mystmd's own `mystParse` doesn't match them either.
The rest of this page is about the first comparison.

## What an adapter would need to do

The table at the end counts failing examples by where their tree first differs from mystmd's.

Code `lang` and `meta`
: mystmd sets `lang: ""` on code with no language, and drops `meta`, the text after the language.
  `toMystmd` does the same.

List `spread`
: mystmd sets `spread: false` on every list and `spread: true` on every list item, whatever the blank lines.
  Its `listItemParagraphs` pass already wraps the text of tight list items in paragraphs, like mdast.

Resolved references
: mystmd turns `[text][ref]` into a `link` and `![alt][ref]` into an `image`, and drops the `definition` nodes.
  mdast keeps `linkReference`, `imageReference` and `definition`.

Smartquotes
: mystmd turns straight quotes into curly ones, and `...` into `…`.

Images out of paragraphs
: mystmd's `hoistSingleImagesOutofParagraphs` replaces a paragraph that only has an image with the image.

Linkify
: `myst build` turns bare URLs like `www.example.com` into links, including in directive arguments like a figure's.
  `micromark-extension-gfm-autolink-literal` does something similar, with different rules.

URL encoding
: mystmd percent-encodes link URLs, like `/föö` to `/f%C3%B6%C3%B6`.

Blocks
: mystmd's `nestBlocks` puts the content after each `+++` in a `block` node, instead of a `blockBreak` node before it.

Front matter
: mystmd turns front matter into a `code` node with `lang: "yaml"`, where mdast has a `yaml` node.
  `toMystmd` does the same.

Tables
: mystmd puts `align` on each cell instead of the table, and marks the cells of the first row with `header: true`.

A few examples fail for reasons an adapter can't fix:

- micromark follows CommonMark 0.31.2 and markdown-it follows 0.30, which ended HTML comments differently.
- mdast keeps line endings inside inline code, and markdown-it turns them into spaces.
- markdown-it drops the last line ending of an HTML block at the end of a file.

## Where the trees first differ

Each row is a group of failing examples whose tree first differs from mystmd's at the same place.
Values in quotes are replaced with `"…"`, so that similar failures share a row.
To see the full diff for an example, run `npm run score -- "<example>"`.

:::{listing}
:source: json
:path: data/differences.json
:columns: title,count,example
:sort: count-desc
:sortable:
:limit: 0
:::
