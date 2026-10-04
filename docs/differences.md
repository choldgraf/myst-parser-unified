# Differences from mystmd

An example passes when our tree is the same as the one mystmd's own parser builds from the example's source.
Our tree is standard [mdast](https://github.com/syntax-tree/mdast).
mystmd's parser runs a few extra passes and has some habits of its own.
So each difference below is something an adapter from mdast to mystmd's shape would need to do.
We keep emitting mdast here, and whether mystmd wants that adapter is up to mystmd.

## How examples are compared

[`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) parses each myst-spec example's source with our parser and with mystmd's `tokensToMyst`, and compares the two trees.
Both trees are from before directives and roles run, so they have generic `mystDirective` and `mystRole` nodes.
We use the same options as `myst build`: mystmd's defaults, which include smartquotes, plus linkify.
We don't use the spec's expected trees, which are from after directives and roles run.

`normalize()` ignores positions (mystmd has no columns), fields that mdast sets to `null`, and `tight` on directives.
[`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts) compares MyST syntax edge cases with mystmd in the same way.

## What an adapter would need to do

The rough counts are failing examples that first differ there, from the table further down.

Code `lang` and `meta` (about 70)
: mystmd sets `lang: ""` on code with no language, and drops `meta`, the text after the language.

List `spread` (about 70)
: mystmd sets `spread: false` on every list and `spread: true` on every list item, whatever the blank lines.
  Its `listItemParagraphs` pass already wraps the text of tight list items in paragraphs, like mdast.

Resolved references (about 65)
: mystmd turns `[text][ref]` into a `link` and `![alt][ref]` into an `image`, and drops the `definition` nodes.
  mdast keeps `linkReference`, `imageReference` and `definition`.

Smartquotes (about 20)
: mystmd turns straight quotes into curly ones, and `...` into `…`.

Images out of paragraphs (about 20)
: mystmd's `hoistSingleImagesOutofParagraphs` replaces a paragraph that only has an image with the image.

Linkify (about 10)
: `myst build` turns bare URLs like `www.example.com` into links, including in directive arguments like a figure's.
  `micromark-extension-gfm-autolink-literal` does something similar, with different rules.

URL encoding (about 10)
: mystmd percent-encodes link URLs, like `/föö` to `/f%C3%B6%C3%B6`.

Blocks (4)
: mystmd's `nestBlocks` puts the content after each `+++` in a `block` node, instead of a `blockBreak` node before it.

Front matter (2)
: mystmd turns front matter into a `code` node with `lang: "yaml"`, where mdast has a `yaml` node.

Tables (1)
: mystmd puts `align` on each cell instead of the table, and marks the cells of the first row with `header: true`.

A few examples fail for reasons an adapter can't fix:

- micromark follows CommonMark 0.31.2 and markdown-it follows 0.30, which ended HTML comments differently.
- We keep line endings inside inline code, where CommonMark turns them into spaces.
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
