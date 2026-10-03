# myst-parser-unified

A proof of concept for parsing MyST Markdown with micromark and unified ([jupyter-book/mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).

We compare our output with mystmd's markdown-it parser on every `myst-spec` example, before directives and roles run.
An example passes when both parsers give the same tree.

## Run it

- `npm run score`: score each example file, and write `scoreboard.json` and the data for this site.
- `npm run score -- "<example id>"`: show why examples don't match.
- `npm run docs`: score, then build this site.
- `npm run docs:live`: score, then serve this site locally.

The numbers on this site come from the last `npm run score`.

## Score per file

Each row is a `myst-spec` example file, and the last row is the total.

:::{listing}
:source: json
:path: data/files.json
:columns: title,pass,total
:limit: 0
:::

See [](./phase-1.md) for why examples don't match.
