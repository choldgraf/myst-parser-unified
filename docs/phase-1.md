# Phase 1: scoreboard and baseline

We parse with plain `mdast-util-from-markdown`, plus the existing micromark extensions for GFM tables, task lists, footnotes, math and front matter.
The extensions don't change the score.
They parse correctly, but every example that uses them also hits one of the differences below.

We compare against the `mdast` that each `myst-spec` example expects, like mystmd's own spec test (`myst-parser/tests/myst.spec.ts`).
Most differences are in how the tree is represented, not in MyST syntax.
Many of them are markdown-it quirks that the spec records as expected output.

## Where the trees first differ

Each row groups the failing examples whose tree first differs from the spec's at the same place.
Quoted values are shown as `"…"`, so similar failures share a row.
Run `npm run score -- "<example>"` to see the full diff for an example.

:::{listing}
:source: json
:path: data/differences.json
:columns: title,count,example
:sort: count-desc
:sortable:
:limit: 0
:::

## How the tree is represented

These differences need a small transform or a `normalize()` rule each, and a decision on which tree is "right".

- **Null or empty fields** (`lang: null vs "…"`, `title: extra in ours`) are the largest group.
  mdast writes `title: null`, `lang: null`, `meta: null` and `align: [null]`, where the spec leaves them out or uses `lang: ""`.
- **List `spread`** (`spread: false vs true`): the spec sets `spread: true` on every list item and `false` on the list, like markdown-it.
  Items in tight lists also hold text directly, with no paragraph (see [Phase 3](./phase-3.md)).
  mdast works out loose and tight lists ([mystmd#1957](https://github.com/jupyter-book/mystmd/issues/1957)).
- **Reference links** (`type linkReference vs link`, `type imageReference vs image`, `type definition vs …`): the spec resolves `[a]` into a `link` and drops the `definition`, like markdown-it.
  mdast keeps `linkReference` and `definition` nodes.
- **Code `meta`** (`meta: extra in ours`): the spec drops the text after the language in a code fence, and mdast keeps it as `meta`.
  This data is lost in mystmd.
- **Front matter** (`type yaml vs thematicBreak`): the spec has no front matter, so `---` lines at the top are thematic breaks.
  mystmd's spec test turns front matter off, and we leave it on.
- **Math render hints**: `mdast-util-math` adds `data.hName` and `data.hChildren` to math nodes for HTML output.
- **Table headers**: the spec marks header cells with `header: true`, and mdast uses the first row instead.
- **CommonMark edge cases** (`inlineCode(inlineCode).value`, `html(html).value`, `link(link).url`, and a few `text(text).value` rows): line endings in code spans, percent-encoding URLs, HTML comments (the spec changed in 0.31), and an email autolink.
- **Examples mystmd skips too**: CommonMark examples 25, 333 and 506 match markdown-it but not the spec, and mystmd's spec test skips them.
  Example 25 differs only in an invisible character, so the spec's copy of these examples may be wrong.

Reference links, code `meta`, and `spread` are cases where mdast's tree is arguably better than the spec's.

## MyST syntax we don't parse yet

- **Backtick directives** (`type code vs mystDirective`): a directive in the spec, a `code` block in ours.
  The spec expects the tree *after* the directive runs, so we'll also need mystmd's directives to match it.
- **Roles** (`type text vs mystRole`, and `text(text).value` rows like `see {ref}`): `{name}` followed by inline code.
- **Targets** `(label)=`, **comments** `%`, and **block breaks** `+++` (`type paragraph vs mystTarget`, `mystComment` or `blockBreak`): none of their examples pass yet.
- **Colon fences**: `myst-spec` has no examples for them yet.

MyST syntax is the real work, which is what Phases 2–4 test.
