# Differences from mystmd

An example passes when our tree is the same as the one mystmd's own parser builds from the example's source.
Our tree is standard [mdast](https://github.com/syntax-tree/mdast).
mystmd's parser also runs a few extra passes, like smartquotes and resolving references.
So each difference below is something an adapter from mdast to mystmd's shape would need to do.
`toMystmd(tree)` is that adapter: an optional pass that changes the tree from `parse` in place.
Each difference says whether `toMystmd` handles it.
This parser keeps emitting mdast.
Whether mystmd wants the adapter is mystmd's call.

## How examples are compared

[`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) parses each myst-spec example's source with our parser and with mystmd's `tokensToMyst`, and compares the two trees.
Both trees are from before directives and roles run, so they have generic `mystDirective` and `mystRole` nodes.
We run mystmd's parser with `myst build`'s options: mystmd's defaults, which include smartquotes, plus linkify.
A directive's nested parse turns on markdown-it's replacements, like `--` to `–`, for every later parse with the same parser.
`myst build` makes a new parser for each file, so it never replaces anything, and we turn replacements back off after each parse.

`normalize()` ignores:

- Positions, because mystmd's nodes have line numbers but no columns.
- Fields that mdast sets to `null`, which mystmd leaves out.
- `tight`, which mystmd sets on directives with no blank line around them.

[`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts) compares MyST syntax edge cases with mystmd in the same way.

A second score runs mystmd's `applyDirectives` and `applyRoles` on our tree, and compares it with the spec's expected tree, with the same `normalize()`.
Some of the spec's trees are older than mystmd's parser, so mystmd's own `mystParse` doesn't match them either.
A third score runs `toMystmd` on our tree, and compares it with mystmd's tree like the first.
A fourth score compares our `mystParse` with mystmd's, trees and messages.
The next section is about the first and third comparisons, and the [`mystParse`](#mystparse) section about the fourth.

## What an adapter would need to do

The table at the end counts failing examples by where their tree first differs from mystmd's.

Code `lang` and `meta`
: mystmd sets `lang: ""` on code with no language, and drops `meta`, the text after the language.
  `toMystmd` does the same.

List `spread`
: mystmd sets `spread: false` on every list and `spread: true` on every list item, whatever the blank lines.
  Its `listItemParagraphs` pass already wraps the text of tight list items in paragraphs, like mdast.
  `toMystmd` sets `spread` the same way.

Resolved references
: mystmd turns `[text][ref]` into a `link` and `![alt][ref]` into an `image`, and drops the `definition` nodes.
  mdast keeps `linkReference`, `imageReference` and `definition`.
  `toMystmd` does the same.

Smartquotes
: mystmd turns straight quotes into curly ones, and apostrophes into `’`.
  `toMystmd` doesn't do this.
  markdown-it picks an opening quote, a closing quote or an apostrophe from the characters on each side, across emphasis, links and inline code, and pairs quotes up by nesting level.
  It also leaves escaped quotes like `\"` alone, and mdast text doesn't show which quotes were escaped.
  So an adapter would need the source as well as the tree, and a port of markdown-it's `smartquotes` rule.

Images out of paragraphs
: mystmd's `hoistSingleImagesOutofParagraphs` replaces a paragraph that only has an image with the image.
  `toMystmd` does the same.

Linkify
: `myst build` turns bare URLs like `www.example.com` into links, including in directive arguments like a figure's.
  `micromark-extension-gfm-autolink-literal` does something similar, with different rules.
  `toMystmd` doesn't do this.
  It would need markdown-it's `linkify-it`, which finds links with its own rules and a list of top-level domains.
  So `mystParse` accepts `markdownit: { linkify: true }` and ignores it.

URL encoding
: mystmd percent-encodes link URLs, like `/föö` to `/f%C3%B6%C3%B6`.
  `toMystmd` does the same for links and images.
  It doesn't turn non-ASCII host names into punycode, like `http://föö.com` to `http://xn--f-1gaa.com`, which markdown-it also does.

Blocks
: mystmd's `nestBlocks` puts the content after each `+++` in a `block` node, instead of a `blockBreak` node before it.
  `toMystmd` does the same, and gives each `block` a position from its `+++` to the end of its content.

Front matter
: mystmd turns front matter into a `code` node with `lang: "yaml"`, where mdast has a `yaml` node.
  `toMystmd` does the same.

Inline code
: mdast keeps line endings inside inline code, and markdown-it turns them into spaces.
  `toMystmd` does the same.

Tables
: mystmd puts `align` on each cell instead of the table, and marks the cells of the first row with `header: true`.
  `toMystmd` does the same.

A few examples fail for reasons an adapter can't fix:

- micromark follows CommonMark 0.31.2 and markdown-it follows 0.30, which ended HTML comments differently.
- markdown-it drops the last line ending of an HTML block at the end of a file.

## Citations

Citations parse like mystmd's, with these differences:

- `![@key]` with no URL is `!` and a `citeGroup` in mystmd, and `![` with a narrative `cite` here, because micromark takes `![` as one token.
- A `citeGroup` in link text, like `[see [@key]](url)`, stops mystmd from seeing the link.
  Here it's a link, with the citation as text, like `[@key](url)`.

## `mystParse`

`mystParse(src, { directives, roles, vfile, markdownit })` in [`src/mystParse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/mystParse.ts) is a drop-in for myst-parser's `mystParse`.
It runs `parse`, then `toMystmd`, then mystmd's `applyDirectives` and `applyRoles`.
Like myst-parser, it adds mystmd's default directives and roles to the ones you pass, and parses a directive's nested content with the same options.

The `dropin` score calls both with the options `mystmd-client` uses: the directives and roles of the extensions `myst build` turns on, `linkify: true`, and a new vfile for each example.
An example passes when the trees match after `normalize()`, and the messages match in order on their text, line, rule and whether they're an error.
Columns aren't compared, but they also match on all 714 passing examples, including the three with messages.
They can differ elsewhere, because markdown-it has no column data for blocks and nested parses, so mystmd puts some messages at column 1.
For example, for a role in a `list-table` cell, mystmd says column 1 and ours says the real column.

Every example that fails also fails with `toMystmd`, for the reasons above; the one MyST example is smartquotes.
Six MyST examples that fail with `toMystmd` pass here, because the directive throws away the part that differed, like a figure's linkified argument.
mystmd writes messages on three examples, for an unknown directive or role, and ours are the same.
[`test/mystParse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/mystParse.test.ts) checks a few more: option errors, nested directives, and roles in directive bodies and `list-table` cells.

What it doesn't do the same:

- `markdownit` is accepted and ignored, because our parser isn't markdown-it.
- It doesn't take myst-parser's `mdast` and `extensions` options.
- mystmd's tokenizer writes a message for YAML options it can't read and for a directive it can't parse, and ours doesn't, because our parser doesn't [support YAML options](how-it-works.md#not-supported-yet) yet.
- It only runs in Node, because it finds myst-parser's files with `node:module`.

Messages go to the `vfile` you pass, through myst-parser's code, which only calls `vfile.message()`.
So a `vfile@5`, which myst-parser's types ask for, and a `vfile@6`, which needs a cast in TypeScript, both get the same messages as with mystmd.
Without a `vfile`, it makes one with myst-parser's own `vfile`, like myst-parser does.

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
