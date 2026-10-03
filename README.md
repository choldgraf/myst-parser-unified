# myst-parser-unified

A proof of concept for parsing MyST Markdown with micromark and unified (jupyter-book/mystmd#1705).

We compare our output with the `mdast` that each `myst-spec` example expects.

- `npm run score`: score per example file, and update `scoreboard.json` and `docs/data/`
- `npm run score -- "<example id>"`: show why examples don't match
- `npm test`: positions are exact, and examples in `scoreboard.json` still match
- `npm run docs`: score, then build the docs site in `docs/`
- `npm run docs:live`: score, then serve the docs site locally

## Findings

The findings and the latest scores are in the docs site at [`docs/`](docs/).
