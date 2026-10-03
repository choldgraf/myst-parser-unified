# Phase 1: scoreboard and baseline

We parse with plain `mdast-util-from-markdown`, plus the existing micromark extensions for GFM tables, task lists, footnotes, math and front matter.
The extensions don't change the score.
They parse correctly, but every example that uses them also hits one of the differences below.

Most differences are in how the tree is represented, not in MyST syntax.
A throwaway script (not `normalize()`) suggests that ignoring null or empty fields, and then list `spread`, would fix a large share of the failures.

## Where the trees first differ

Each row groups the failing examples whose tree first differs from mystmd's at the same place.
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
  mdast writes `title: null`, `lang: null`, `meta: null` and `align: [null]`, where markdown-it leaves them out or uses `lang: ""`.
- **List `spread`** (`spread: false vs true`): markdown-it sets `spread: true` on every list item and `false` on the list.
  mdast works out loose and tight lists ([mystmd#1957](https://github.com/jupyter-book/mystmd/issues/1957)).
- **Reference links** (`type linkReference vs link`, `type definition vs …`): markdown-it resolves `[a]` into a `link` and drops the `definition`.
  mdast keeps `linkReference` and `definition` nodes.
- **Smart quotes** (most of `text(text).value`): myst-parser turns on the markdown-it typographer, so `"a"` becomes `“a”` and `...` becomes `…`.
- **Images on their own** (`type paragraph vs image`): mystmd lifts a paragraph that only holds an image up into a block `image`.
- **Code `meta`** (`meta: extra in ours`): mystmd drops the text after the language in a code fence, and mdast keeps it as `meta`.
  This data is lost in mystmd.
- **Front matter** (`type yaml vs code`): mystmd returns a `code` node with `lang: yaml`, and mdast returns a `yaml` node.
- **Math render hints**: `mdast-util-math` adds `data.hName` and `data.hChildren` to math nodes for HTML output.
- **Table headers**: mystmd marks header cells with `header: true`, and mdast uses the first row instead.
- **CommonMark edge cases** (`inlineCode(inlineCode).value`, `html(html).value`, `link(link).url`, and a few `text(text).value` rows): line endings in code spans, percent-encoding URLs, HTML comments (the spec changed in 0.31), and an email autolink.

Reference links, images on their own, and `spread` are cases where mdast's tree is arguably better than mystmd's.

## MyST syntax we don't parse yet

- **Backtick directives** (`type code vs mystDirective`): a directive in the reference, a `code` block in ours.
- **Roles** (`type text vs mystRole`): `{ref}` followed by inline code.
- **Targets** `(label)=`, **comments** `%`, and **block breaks** `+++` (`type paragraph vs mystTarget`, `comment` or `block`): none of their examples pass yet.
- **Colon fences**: `myst-spec` has no examples for them yet.

MyST syntax is the real work, which is what Phases 2–4 test.
