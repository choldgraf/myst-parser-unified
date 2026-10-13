---
title: myst-parser-unified
---

```{include} ../README.md
:start-line: 2
```

## Score per file

Each row is a `myst-spec` example file, and the last three rows are the MyST, CommonMark and combined totals.
`pass` counts examples that match mystmd's tree before directives and roles run, and `adapted` counts the same after [`toMystmd`](differences.md).
`transformed` counts examples that match the spec's tree after directives and roles run.
The numbers come from the last `npm run score`.

:::{listing}
:source: json
:path: data/files.json
:columns: title,pass,adapted,transformed,total
:limit: 0
:::
