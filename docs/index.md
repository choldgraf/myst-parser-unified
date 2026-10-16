---
title: myst-parser-unified
---

```{include} ../README.md
:start-line: 2
```

(score-per-file)=
## Score per file

Each row is a `myst-spec` example file, and the last three rows are the MyST, CommonMark and combined totals.
Each column counts the examples that match:

- `raw`: mystmd's tree straight from the parser.
- `adapted`: the same, after [`toMystmd`](differences.md).
- `transformed`: the spec's tree, after directives and roles run.
- `dropin`: mystmd's tree and messages, from our [`mystParse`](differences.md#mystparse).
- `ceiling`: the spec's tree, from myst-parser's own `mystParse`.

The numbers come from the last `npm run score`.

:::{listing}
:source: json
:path: data/files.json
:columns: title,raw,adapted,transformed,dropin,ceiling,total
:limit: 0
:::
