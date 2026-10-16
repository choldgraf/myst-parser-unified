# What we learned

This page is for mystmd maintainers and people building MyST tools.
It says what this parser found, what an adapter from its tree to mystmd's covers, and what blocks mystmd from switching.

## Why exact positions matter

Editors, language servers and source maps need the line and column of every node.
mystmd's markdown-it parser [records line numbers for blocks, but no columns inside a line](https://github.com/jupyter-book/mystmd/issues/2864).
[mystmd-lsp's design doc](https://github.com/choldgraf/mystmd-lsp/blob/main/docs/design.md) lists where that leaves positions missing or wrong, like on roles.
Directive transforms also drop `position` on the figure and table containers they create ([myst-author upstream asks](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md#data-and-packaging-gaps-candidates-for-small-fixes)).

Tools work around this.
mystmd-client's `parseMyst`, which [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) calls, copies a directive's position onto its children before transforms run.
mystmd-lsp's index falls back to the first positioned descendant of a node.

Here every node has an exact line, column and offset, including in role bodies and directive arguments.
The [`mystParse` section](differences.md#mystparse) has a case where mystmd reports column 1 and this parser reports the real column.

(measured-results)=
## Measured results

`npm run score` scores the myst-spec examples five ways:

| Score | MyST (of 90) | CommonMark (of 651) |
| --- | --- | --- |
| Raw tree, against mystmd's tree | 65 | 398 |
| With `toMystmd`, against mystmd's tree | 83 | 625 |
| After mystmd's directives and roles, against the spec's `mdast` | 57 | 420 |
| Drop-in `mystParse`, against myst-parser's `mystParse` | 89 | 625 |
| myst-parser's own `mystParse`, against the spec's `mdast` | 53 | 558 |

The last row is a ceiling for the third, because the spec is older than mystmd's parser.
myst-parser fails 37 MyST examples: figures, tables, block breaks, comments, and options typed as numbers.
30 of this parser's 33 MyST misses after directives and roles are among them.
That comes from comparing the `transformed` and `ceiling` lists in `scoreboard.json`.

`MYST_CORPUS=<folder> npm run corpus` compares both parsers on every `.md` file in a local folder, skipping dot-folders and `_build`.
Our folder held:

- [jupyter-book/mystmd](https://github.com/jupyter-book/mystmd/tree/3b00993/docs) at `3b00993`, its `docs/`.
- [jupyter-book/jupyter-book](https://github.com/jupyter-book/jupyter-book/tree/11acb1b/docs) at `11acb1b`, its `docs/`.
- [2i2c-org/docs](https://github.com/2i2c-org/docs/tree/c1ca3ba) at `c1ca3ba`.
- [jupyter-book/example-outputs](https://github.com/jupyter-book/example-outputs/tree/d7ee89e) at `d7ee89e`.
- The docs and demo of [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp), this repo's docs, and the README and ROADMAP of [myst-syntax](https://github.com/choldgraf/myst-syntax), as of the start of this work.

| Measure | Result |
| --- | --- |
| Files parsed (none threw) | 599 |
| Raw trees matching mystmd's | 157 |
| Trees matching mystmd's with `toMystmd` | 290 |
| Files where every start line agrees with mystmd's | 270 |
| Nodes whose start line differs | 7395 |
| Parse time, ours (total / median per file) | about 950 ms / 0.4 ms |
| Parse time, mystmd (total / median per file) | about 470 ms / 0.2 ms |

Start lines disagree because markdown-it gives inline nodes on later lines of a paragraph the paragraph's line.

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
  The drop-in `mystParse` gives myst-parser's tree and messages on all but one MyST example ([Measured results](#measured-results)).
  It accepts a `vfile@5` or `vfile@6` ([`test/mystParse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/mystParse.test.ts)).
  Smartquotes and linkify are the gap.

Positions for the parts inside nodes
: Partly met.
  Directive arguments and options, including each `mystOption` node, have exact positions ([`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts), [`test/inline-options.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/inline-options.test.ts)).
  The label in `(x)=` has no node of its own, only the `mystTarget` around it.
  The `<target>` in `` {ref}`text <target>` `` is a positioned node in the role body, which the `ref` role drops.

Tolerance of half-typed input
: Met, as far as mystmd goes.
  An unclosed fence runs to the end of the document and an unclosed role stays text, like in mystmd ([`test/parse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/parse.test.ts)).
  No corpus file threw.

Speed enough to parse every project page
: Met, as the corpus table above shows.

## What it needs upstream

- [Column positions in mystmd's parser](https://github.com/jupyter-book/mystmd/issues/2864).
- [A unified-native parser for mystmd](https://github.com/jupyter-book/mystmd/issues/1705).
- [myst-spec as a conformance suite that other parsers reuse](https://github.com/jupyter-book/mystmd/issues/3078).
- An mdast adapter in mystmd, myst-author's proposal U10 ([myst-author upstream asks](https://github.com/choldgraf/myst-author/blob/main/upstream/README.md)).
- myst-parser exporting `applyDirectives` and `applyRoles`, or accepting a custom tokenizer, so `mystParse` doesn't need an exact pin. Not filed yet, but [related to the unified-native parser issue](https://github.com/jupyter-book/mystmd/issues/1705).

## Where it could go next

- Smartquotes and linkify in `toMystmd`.
- `\r\n` line endings: this parser keeps them, and mystmd turns them into `\n`.
- Typed YAML scalars in option blocks, which need a YAML parser ([YAML options](differences.md#yaml-options)).
- mystmd's error nodes for malformed directive and role headers ([inline options](differences.md#inline-options)).
