# What we learned

This page is for mystmd maintainers and people building MyST tools.
It says what this parser found, what an adapter from its tree to mystmd's covers, and what blocks mystmd from switching.

## Why exact positions matter

Editors, language servers and source maps need the line and column of every node.
mystmd's markdown-it parser doesn't give them ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)).
This is what we measured:

- markdown-it records line numbers for blocks, but no columns inside a line.
- In mystmd's parse of one sample, roles had no position after transforms, and before transforms their columns ran past the end of the line.
- In the same sample, a `[](#x)` link got a placeholder position, line 4 from column 1 to column 1.
- `<#x>` wasn't parsed as a reference, and `@key` was reported one line early.
- Directive transforms drop `position` on the nodes they create, like figure and table containers.
  Built page JSON has the same gap.

Tools work around this.
mystmd-client's `parseMyst`, which [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) calls, copies a directive's position onto its children before transforms run.
mystmd-lsp's index falls back to the first positioned descendant of a node.

Here every node has an exact line, column and offset, including in role bodies and directive arguments.
In the drop-in comparison, for a role in a `list-table` cell, mystmd puts the message at column 1 and this parser at the role's column ([details](differences.md#mystparse)).

## Measured results

`npm run score` scores the myst-spec examples four ways:

| Score | MyST (of 90) | CommonMark (of 651) |
| --- | --- | --- |
| Raw tree, against mystmd's tree | 65 | 398 |
| With `toMystmd`, against mystmd's tree | 83 | 625 |
| After mystmd's directives and roles, against the spec's `mdast` | 57 | 420 |
| Drop-in `mystParse`, against myst-parser's `mystParse` | 89 | 625 |

The third score has a ceiling.
mystmd's own `mystParse` against the spec's `mdast` scores 53 of 90 MyST and 558 of 651 CommonMark examples, because the spec is older than the parser.
It fails 37 MyST examples: figures, tables, block breaks, comments, and options typed as numbers.
30 of this parser's 33 MyST misses are among them.
`npm run score` doesn't print the ceiling; we measured it by running mystmd's `mystParse` through the same comparison.

`MYST_CORPUS=<folder> npm run corpus` compares both parsers on 599 `.md` files from real projects:

| Measure | Result |
| --- | --- |
| Files parsed (none threw) | 599 |
| Raw trees matching mystmd's | 157 |
| Trees matching mystmd's with `toMystmd` | 290 |
| Files where every start line agrees with mystmd's | 270 |
| Nodes whose start line differs | 7395 |
| Parse time, ours (total / median per file) | 947 ms / 0.44 ms |
| Parse time, mystmd (total / median per file) | 474 ms / 0.22 ms |

Start lines disagree because markdown-it gives inline nodes on later lines of a paragraph the paragraph's line.

## What an adapter covers, and what it can't

`toMystmd` handles the differences in [Differences from mystmd](differences.md#what-an-adapter-would-need-to-do).
Two are left:

- Smartquotes need the source, to see which quotes were escaped, and a port of markdown-it's `smartquotes` rule.
  With smartquotes off in mystmd's parser, 19 more spec examples and 176 more corpus files match with `toMystmd`.
- Linkify needs markdown-it's `linkify-it`.

No adapter can fix these two:

- micromark follows CommonMark 0.31.2 and markdown-it follows 0.30, which end HTML comments differently.
- markdown-it drops the last line ending of an HTML block at the end of a file.

The comparison itself had a bug.
One directive in a document turns on markdown-it's `--` replacements for every later parse with the same tokenizer, because `markdown-it-myst/dist/nestedParse.js` re-enables core rules.
`myst build` makes a tokenizer per file, so it never sees this.
[`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) now turns replacements off after each parse, which moved the raw baseline by two MyST examples.

## What blocks a switch in mystmd

mystmd-lsp's design doc (`docs/design.md`, "Replacing the reference regexes") lists four requirements for a parser that replaces its reference regexes.

Pre-transform myst-spec mdast, so myst-transforms still run
: Partly met.
  The drop-in `mystParse` gives myst-parser's tree and messages on 89 of 90 MyST examples, with a `vfile@5` or `vfile@6` ([`test/mystParse.test.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/mystParse.test.ts)).
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
: Met.
  The corpus takes 947 ms for 599 files against mystmd's 474 ms, with a median of 0.44 ms per file.

Two changes upstream would help:

- myst-parser could export `applyDirectives` and `applyRoles`, or accept a custom tokenizer, since today we reach them through `dist/` with an exact pin ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705), [U10 mdast adapter](https://github.com/choldgraf/myst-author/blob/main/upstream/U10-mdast-adapter.md)).
- myst-spec could be a conformance suite that other parsers reuse ([mystmd#3078](https://github.com/jupyter-book/mystmd/issues/3078)).

## Where it could go next

- Smartquotes and linkify in `toMystmd`.
- `\r\n` line endings: this parser keeps them, and mystmd turns them into `\n`.
- Typed YAML scalars in option blocks, which need a YAML parser ([YAML options](differences.md#yaml-options)).
- mystmd's error nodes for malformed directive and role headers ([inline options](differences.md#inline-options)).
