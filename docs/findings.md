# What we learned

This page is for mystmd maintainers and people building MyST tools.
It says what this parser found, what an adapter from its tree to mystmd's covers, and what blocks mystmd from switching.

## Why exact positions matter

Editors, language servers and source maps need the line and column of every node.
mystmd's markdown-it parser records line numbers for blocks, but no columns inside a line ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)).
[mystmd-lsp's design doc](https://github.com/choldgraf/mystmd-lsp/blob/main/docs/design.md) lists where that leaves positions missing or wrong, like on roles and on the nodes directive transforms create.

Tools work around this.
mystmd-client's `parseMyst`, which [mystmd-lsp](https://github.com/choldgraf/mystmd-lsp) calls, copies a directive's position onto its children before transforms run.
mystmd-lsp's index falls back to the first positioned descendant of a node.

Here every node has an exact line, column and offset, including in role bodies and directive arguments.
In the drop-in comparison, for a role in a `list-table` cell, mystmd puts the message at column 1 and this parser at the role's column ([details](differences.md#mystparse)).

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
30 of this parser's 33 MyST misses after directives and roles are among them, which comes from comparing the `transformed` and `ceiling` lists in `scoreboard.json`.

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
- Linkify needs markdown-it's `linkify-it`.

The same page lists two differences that no adapter can fix.

## What blocks a switch in mystmd

[mystmd-lsp's design doc](https://github.com/choldgraf/mystmd-lsp/blob/main/docs/design.md) ("Replacing the reference regexes") lists four requirements for a parser that replaces its reference regexes.

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
: Met; see the corpus table above.

Two changes upstream would help:

- myst-parser could export `applyDirectives` and `applyRoles`, or accept a custom tokenizer, since today we reach them through `dist/` with an exact pin ([mystmd#1705](https://github.com/jupyter-book/mystmd/issues/1705), [U10 mdast adapter](https://github.com/choldgraf/myst-author/blob/main/upstream/U10-mdast-adapter.md)).
- myst-spec could be a conformance suite that other parsers reuse ([mystmd#3078](https://github.com/jupyter-book/mystmd/issues/3078)).

## Where it could go next

- Smartquotes and linkify in `toMystmd`.
- `\r\n` line endings: this parser keeps them, and mystmd turns them into `\n`.
- Typed YAML scalars in option blocks, which need a YAML parser ([YAML options](differences.md#yaml-options)).
- mystmd's error nodes for malformed directive and role headers ([inline options](differences.md#inline-options)).
