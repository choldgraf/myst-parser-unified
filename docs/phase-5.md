# Phase 5: the rest

Phase 4 (colon fences) came for free in [Phase 3](./phase-3.md).
This phase adds the last MyST syntax that the spec tests, and estimates the work for the syntax it doesn't.

## What we built

`src/blocks.ts` adds three small constructs, each a line of its own that can interrupt a paragraph:

- targets, like `(my-label)=`;
- comments, like `% a comment`, where the `%` lines right after it join the same comment;
- block breaks, like `+++` or `+++ {"meta": "data"}`.

All of the `blocks`, `comments` and `references.target` examples now match (see the score table on the [home page](./index.md)).
`test/parse.test.ts` also compares edge cases with mystmd's parser.

## What we learned

- These took minutes each, because they follow the same pattern as the other constructs.
- Lists open before any block construct gets a look at the line, so `+ + +` (with spaces) is a list for us, and a block break for mystmd.
  micromark's lists only make an exception for thematic breaks like `* * *`, and that's built in.
  Plain `+++`, which is what the MyST docs use, works.
- vitest loads micromark's development build, which checks that tokenizers follow micromark's rules.
  It caught a bug that the normal build quietly accepted, so it's worth keeping the tests on vitest.

## What's left

This is MyST syntax that mystmd turns on, but that no spec example tests.
Each estimate is relative to the constructs we've already built.

- **Dollar math** (medium).
  mystmd uses markdown-it-dollarmath, which differs from `micromark-extension-math`: `$$ x $$` on one line is display math, and `$$ … $$ (eq1)` adds a label.
  We'd adapt `micromark-extension-math`, and drop the `data.hName` render hints it adds.
- **Math environments** like `\begin{equation} … \end{equation}` (small).
  One block construct, shaped like a fence that starts with `\begin{`.
- **Citations** like `[@doe2020; @roe]` and `@doe2020` (medium to large).
  `@doe2020` is a small inline construct.
  `[@…]` is harder, because CommonMark already treats `[` as the start of a link, so it has to work with micromark's link handling rather than around it.
- **Definition lists** like `Term` then `: Definition` (medium).
  `micromark-extension-definition-list` exists, but its node names differ from mystmd's.
- **Inline options** in roles and directives, like `` {sub .class #id}`2` `` (small to medium).
  `micromark-extension-directive` already parses `{#id .class key=value}`, so we'd adapt its attribute parser.
- **YAML directive options** in a `---` block at the start of a directive's body (small).
  The tokenizer has a place for it, but mystmd also parses string values as inline markdown, and there's no exact position for those inside YAML.

There are also differences in the shape of the tree, which need a decision rather than a parser:
the markdown-it habits that the spec records (see [Phase 1](./phase-1.md)), table header cells (`header: true`), front matter as a `code` node, and the `block`, `tight` and paragraph changes that mystmd makes by default but turns off in its spec test.
