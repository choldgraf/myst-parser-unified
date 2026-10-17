# What we learned

This page is for mystmd maintainers and people building MyST tools.
It says what this parser found, what an adapter from its tree to mystmd's covers, and what blocks mystmd from switching.

## Why exact positions matter

Editors, language servers and source maps need the line and column of every node.
mystmd's markdown-it parser [records line numbers for blocks, but no columns inside a line](https://github.com/jupyter-book/mystmd/issues/2864).
[mystmd-lsp's design doc](https://github.com/choldgraf/mystmd-lsp/blob/main/docs/design.md) lists where that leaves positions missing or wrong, like on roles.
Directive transforms also [drop `position` on the figure and table containers they create](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md#data-and-packaging-gaps-file-as-small-bug-reports).

Tools work around this.
mystmd-client's `parseMyst`, which [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) calls, copies a directive's position onto its children before transforms run.
mystmd-lsp's index falls back to the first positioned descendant of a node.

Here every node has an exact line, column and offset, including in role bodies and directive arguments.
The [`mystParse` section](differences.md#mystparse) has a case where mystmd reports column 1 and this parser reports the real column.

(measured-results)=
## Measured results

`npm run score` scores the myst-spec examples five ways, and [Score per file](index.md#score-per-file) has the numbers and what each one counts.
The `ceiling` score is a ceiling for `transformed`, because where myst-parser itself disagrees with the spec we can't do better.
Most of the MyST examples this parser misses after directives and roles are ones myst-parser misses too.
Comparing the `transformed` and `ceiling` lists in `scoreboard.json` shows which.
Comparing the `transformed` and `ceiling` lists in `scoreboard.json` shows which.

`MYST_CORPUS=<folder> npm run corpus` compares both parsers on every `.md` file in a local folder, skipping dot-folders and `_build`.
Our folder held the docs of [mystmd](https://github.com/jupyter-book/mystmd/tree/main/docs), [jupyter-book](https://github.com/jupyter-book/jupyter-book/tree/main/docs), [2i2c](https://github.com/2i2c-org/docs) and [example-outputs](https://github.com/jupyter-book/example-outputs), plus the docs of [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp), [myst-syntax](https://github.com/choldgraf/myst-syntax) and this repo.

| Measure | Result |
| --- | --- |
| Files parsed (none threw) | 599 |
| Raw trees matching mystmd's | 157 |
| Trees matching mystmd's with `toMystmd` | 290 |
| Median parse time per file, ours and mystmd's | about 0.4 ms and 0.2 ms |

markdown-it gives inline nodes on later lines of a paragraph the paragraph's line, so start lines only agree with mystmd's on fewer than half the files.

## What an adapter covers, and what it can't

`toMystmd` handles the differences in [Differences from mystmd](differences.md#what-an-adapter-would-need-to-do).
Two are left:

- Smartquotes need the source, to see which quotes were escaped, and a port of markdown-it's `smartquotes` rule.
- Linkify needs markdown-it's `linkify-it`.

The same page lists [two other differences that no adapter can fix](differences.md#what-an-adapter-would-need-to-do): how CommonMark 0.30 and 0.31.2 end HTML comments, and the last line ending of an HTML block, which markdown-it drops.

## What blocks a switch in mystmd

[mystmd-lsp's design doc](https://github.com/choldgraf/mystmd-lsp/blob/main/docs/design.md) ("Replacing the reference regexes") lists four requirements for a parser that replaces its reference regexes.

Pre-transform myst-spec mdast, so myst-transforms still run
: Partly met.
  The drop-in `mystParse` gives myst-parser's tree and messages on nearly every MyST example.
  It accepts a `vfile@5` or `vfile@6`.
  Smartquotes and linkify are the gap.

Positions for the parts inside nodes
: Partly met.
  Directive arguments and options, including each `mystOption` node, have exact positions.
  The label in `(x)=` has no node of its own, only the `mystTarget` around it.
  The `<target>` in `` {ref}`text <target>` `` is a positioned node in the role body, which the `ref` role drops.

Tolerance of half-typed input
: Met, as far as mystmd goes.
  An unclosed fence runs to the end of the document and an unclosed role stays text, like in mystmd.
  No corpus file threw.

Speed enough to parse every project page
: Met, as the corpus table above shows.

## What it needs upstream

- [Column positions in mystmd's parser](https://github.com/jupyter-book/mystmd/issues/2864).
- [A unified-native parser for mystmd](https://github.com/jupyter-book/mystmd/issues/1705).
- [myst-spec as a conformance suite that other parsers reuse](https://github.com/jupyter-book/mystmd/issues/3078).
- [An mdast adapter in mystmd](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md), which myst-author proposes.
- myst-parser exporting `applyDirectives` and `applyRoles`, or accepting a custom tokenizer, so `mystParse` doesn't need an exact pin.

## Where it could go next

- Smartquotes and linkify in `toMystmd`.
- `\r\n` line endings: this parser keeps them, and mystmd turns them into `\n`.
- Typed YAML scalars in option blocks, which need a YAML parser ([YAML options](differences.md#yaml-options)).
- mystmd's error nodes for malformed directive and role headers ([inline options](differences.md#inline-options)).
