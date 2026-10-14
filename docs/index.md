---
title: myst-parser-unified
---

```{include} ../README.md
:start-line: 2
```

## Score per file

Each row is a `myst-spec` example file, and the last three rows are the MyST, CommonMark and combined totals.
`raw` counts examples that match mystmd's tree before directives and roles run, and `adapted` counts the same after [`toMystmd`](differences.md).
`transformed` counts examples that match the spec's tree after directives and roles run.
`dropin` counts examples where our [`mystParse`](differences.md#mystparse) gives the same tree and messages as mystmd's.
`ceiling` counts examples where myst-parser's own `mystParse` matches the spec's tree, which mystmd misses too where the spec is older than its parser.
The numbers come from the last `npm run score`.

:::{listing}
:source: json
:path: data/files.json
:columns: title,raw,adapted,transformed,dropin,ceiling,total
:limit: 0
:::
