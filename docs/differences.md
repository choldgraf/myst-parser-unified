# Differences from mystmd

An example passes when our tree is the same as the one mystmd's own parser builds from the example's source.
Our tree is standard [mdast](https://github.com/syntax-tree/mdast).
mystmd's parser also runs a few extra passes, like smartquotes and resolving references.
So each difference below is something an adapter from mdast to mystmd's shape would need to do.
`toMystmd(tree)` is that adapter: an optional pass that changes the tree from `parse` in place.
Each difference says whether `toMystmd` handles it.

## How examples are compared

[`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) parses each myst-spec example's source with our parser and with mystmd's `tokensToMyst`, and compares the two trees.
Both trees are from before directives and roles run, so they have generic `mystDirective` and `mystRole` nodes.
We run mystmd's parser with `myst build`'s options: mystmd's defaults, which include smartquotes, plus linkify.

`normalize()` ignores:

- Positions, because mystmd's nodes have line numbers but no columns.
- Fields that mdast sets to `null`, which mystmd leaves out.
- `tight`, which mystmd sets on directives with no blank line around them.

[`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts) compares MyST syntax edge cases with mystmd in the same way.

The spec comparison is the `raw` score, and [the score table](index.md#score-per-file) says what the others compare.
The next section is about `raw` and `adapted`, and the [`mystParse`](#mystparse) section about `dropin`.

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

Two differences no adapter can fix:

- micromark follows CommonMark 0.31.2 and markdown-it follows 0.30, which ended HTML comments differently.
- markdown-it drops the last line ending of an HTML block at the end of a file.

## Citations

Citations parse like mystmd's, with these differences:

- In mystmd, `![@key]` with no URL is `!` and a `citeGroup`.
  Here it's `![` and a narrative `cite`, because micromark takes `![` as one token.
- A `citeGroup` in link text, like `[see [@key]](url)`, stops mystmd from seeing the link.
  Here it's a link, with the citation as text, like `[@key](url)`.

## Definition lists

Definition lists parse like mystmd's, with two differences that come from markdown-it-deflist:

- After a description, mystmd takes any line followed by a description as the next term, even a heading like `# Heading` or a list item like `- item`.
  Here a term is always a paragraph, so those stay a heading or a list.
- A term and a description indented inside a description, right after its text, stay text in both parsers.
  But for `Term\n: Text\n  Term 2\n  : Text 2`, mystmd's text is `Text\nTerm 2: Text 2`, without the line ending before the `:`.

## Math

Dollar math and amsmath environments parse like mystmd's, with two differences:

- In a list item or block quote, mystmd keeps the container's indent or `> ` in a math block's `value`, because markdown-it slices the value from the source.
  Here the value is only the math, like a code block's value.
- In a tight list item, mystmd moves `$$x$$` out of its paragraph, because its `listItemParagraphs` pass doesn't count a `math` node as inline content.
  Here it stays in the paragraph, like in a loose list item, and `toMystmd` doesn't move it.

## YAML options

mystmd reads a directive's YAML block of options with js-yaml, and we don't depend on a YAML parser.
Every YAML block of options in [the corpus](findings.md#measured-results) is a flat map of strings.
myst-spec has none.
So we read flat `key: value` lines, and the value is the text after the colon.

On those, the options and the body match mystmd's.
Like in mystmd, a block with no keys or with a key twice stays in the body, and a block with no closing `---` runs to the end of the directive.
Anything more needs a YAML parser:

- A value is always a string, so `width: 1.0` is `"1.0"`, where js-yaml reads the number `1`, and the same for `true` and `null`.
  Quotes and `# comments` stay in the value.
- A block with any other line, like an indented line, a `|` or `>` block, a `- item`, a comment line or a key with no value, stays in the body.
  js-yaml reads most of these as options.
- A value that js-yaml can't read, like `[`, is still an option here, where mystmd leaves the block in the body and writes a warning.

Two differences come from how mystmd handles the body:

- When a `---` block isn't options, mystmd parses the body with the block as front matter, so the body's children leave it out.
  Here the block stays in the body as a thematic break and text.
  The body's `value` is the same.
- After a YAML block, mystmd drops every other `---` line from the body.
  Here they stay in the body.

## Inline options

Inline options, like ```` ```{note .a #b key=value} ````, parse like mystmd's, with these differences:

- mystmd parses the value of a directive's `key=value` twice, so the option's text is doubled, like `valuevalue`.
  Its `value` and the directive's `options` are right, and a role's option text isn't doubled.
  Here the text is there once.
- mystmd builds a `mystDirectiveError` or `mystRoleError` for a malformed header, like `{ }` or `{note a b}`, and here it stays a code block or text.
- `key=""` is an empty `key` option with no `mystOption` node in mystmd, and here the braces aren't a directive or role.
- A quoted value can't have backticks here, even in a colon fence or a role, where mystmd allows them.

(mystparse)=
## `mystParse`

`mystParse(src, { directives, roles, vfile, markdownit })` in [`src/mystParse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/mystParse.ts) is a drop-in for myst-parser's `mystParse`.
It runs `parse`, then `toMystmd`, then mystmd's `applyDirectives` and `applyRoles`.
Like myst-parser, it adds mystmd's default directives and roles to the ones you pass, and parses a directive's nested content with the same options.

The `dropin` score calls both with the options `mystmd-client` uses: the directives and roles of the extensions `myst build` turns on, `linkify: true`, and a new vfile for each example.
An example passes when the trees match after `normalize()`, and the messages match in order on their text, line, rule and whether they're an error.
Columns aren't compared, but they also match on every passing `dropin` example, including the ones with messages.
They can differ elsewhere, because markdown-it has no column data for blocks and nested parses, so mystmd puts some messages at column 1.
For example, for a role in a `list-table` cell, mystmd says column 1 and ours says the real column.

Every example that fails here also fails with `toMystmd`.
The only MyST failure is smartquotes.
Some MyST examples that fail with `toMystmd` pass here, because the directive throws away the part that differed, like a figure's linkified argument.
Where mystmd writes a message, for an unknown directive or role, ours is the same.
[`test/mystParse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/mystParse.test.ts) checks a few more: option errors, nested directives, and roles in directive bodies and `list-table` cells.

What it doesn't do the same:

- `markdownit` is accepted and ignored, because our parser isn't markdown-it.
- It doesn't take myst-parser's `mdast` and `extensions` options.
- mystmd's tokenizer writes a message for YAML options it can't read and for a directive it can't parse, and ours doesn't.
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
