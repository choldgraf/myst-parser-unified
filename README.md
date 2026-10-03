# myst-parser-unified

A proof of concept for parsing MyST Markdown with micromark and unified ([jupyter-book/mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705)).

We compare our output with the `mdast` that each `myst-spec` example expects.
An example passes when both trees are the same.
The findings and the latest scores are in a MyST site in `docs/`.

- `npm run score`: score each example file, and write `scoreboard.json` and the data for the site.
- `npm run score -- "<example id>"`: show why examples don't match.
- `npm test`: positions are exact, syntax edge cases match mystmd's parser, and examples in `scoreboard.json` still match.
- `npm run docs`: score, then build the site.
- `npm run docs:live`: score, then serve the site locally.
