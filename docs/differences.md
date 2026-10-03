# Differences from the spec

Almost every example that fails does so because the spec's tree has a different shape from ours, not because of MyST syntax.
mystmd parses with markdown-it, and the spec records many of markdown-it's habits as expected output.
Our tree follows [mdast](https://github.com/syntax-tree/mdast) instead.
[mystmd#3078](https://github.com/jupyter-book/mystmd/issues/3078) proposes fixing these in the spec.

## Where the trees first differ

Each row is a group of failing examples whose tree first differs from the spec's at the same place.
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

## Why they differ

Empty fields
: We write `title: null`, `lang: null`, `meta: null` and `align: [null]`.
  The spec leaves these out, or uses `lang: ""`.

Lists
: The spec puts `spread: true` on every list item, even in tight lists (lists with no blank lines between items).
  It also puts the text of a tight list item straight in the item, with no paragraph.
  We work out whether a list is tight, and always wrap the text in a paragraph ([mystmd#1957](https://github.com/jupyter-book/mystmd/issues/1957)).
  mystmd's parser now adds the paragraph too, but the spec was never updated, so mystmd's spec test turns it off.

Reference links
: The spec turns `[text][ref]` into a `link`, and drops the `[ref]: url` definition.
  We keep both, as `linkReference` and `definition` nodes.

Code `meta`
: The spec drops the text after the language in a code fence, like `extra` in ```` ```python extra ````.
  We keep it as `meta`.

Front matter
: The spec has no front matter, so `---` lines at the top of a file are thematic breaks.
  We parse them as front matter, like mystmd does by default.

Table headers
: The spec marks header cells with `header: true`.
  We treat the first row as the header instead.

CommonMark edge cases
: The spec's CommonMark examples are from version 0.30, and micromark follows 0.31.2, which changed how HTML comments end.
  We also keep line endings inside inline code, where CommonMark turns them into spaces.

Examples mystmd skips
: Four of the failing CommonMark examples (25, 333, 353 and 506) are ones that mystmd's spec test skips too.

For reference links, code `meta` and lists, our tree keeps information that the spec's tree loses.
