# How it works

The parser is `mdast-util-from-markdown` with micromark extensions.
micromark splits the source into tokens, and `mdast-util-from-markdown` turns those tokens into an mdast tree.
Each MyST construct is one extension with two parts:

- a **tokenizer**, which tells micromark how to find the syntax;
- a **handler**, which builds the same nodes that mystmd's parser builds.

The extensions are in `src/`, and [`src/parse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/parse.ts) puts them together.
Every node gets an exact line, column and offset, including in nested content, so tools like editors can point at the right spot in the source.

## Roles

[`src/roles.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/roles.ts) parses roles like `` {sub}`2` ``.
A role is `{name}` followed by a body in backticks.
Like inline code, the body ends at a run of exactly as many backticks as it started with.

The body is parsed as inline markdown where it sits in the document, so `` {sub}`*2*` `` has an `emphasis` node inside it.
mystmd parses the body again as a separate string.
So its nodes inside a role have line numbers, but no columns ([mystmd#2864](https://github.com/jupyter-book/mystmd/issues/2864)).

## Directives

[`src/directives.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/directives.ts) parses directives like this:

````markdown
```{note} An argument
:class: tip

The body.
```
````

The fence can use backticks, tildes or colons, and works like a fenced code block.
A backtick or tilde fence without `{name}` is a normal code block.
Option lines like `:class: tip` come right after the opening fence.

The argument and option values are parsed as inline markdown, and the body as block markdown, all in place.
So nested directives work, and every node has an exact position.
The tokenizer is modeled on the `:::name` containers in [`micromark-extension-directive`](https://github.com/micromark/micromark-extension-directive).

## Targets, comments and block breaks

[`src/blocks.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/blocks.ts) parses three constructs that each take up a whole line:

- targets, like `(my-label)=`, which label the next block so you can link to it;
- comments, like `% a comment`, where several `%` lines in a row make one comment;
- block breaks, like `+++` or `+++ {"meta": "data"}`, which split a page into blocks.

Like a heading, each one can come right after a line of text, without a blank line between.

## Scoring

mystmd handles directives and roles in two steps.
First its parser builds a generic `mystDirective` or `mystRole` node, and our handlers build the same nodes.
Then mystmd *runs* each one, which replaces it with real content, like an `admonition` node for `{note}`.

The spec expects the tree after that second step.
So [`test/spec.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/test/spec.ts) runs mystmd's own `applyDirectives` and `applyRoles` on our tree before comparing.
These come from `myst-parser`, mystmd's parser package, which doesn't export them.
So we import their files by path, and pin `myst-parser` to an exact version in case those paths change.

`normalize()` in `test/spec.ts` removes a few differences we accept, with a comment on each.
The differences that remain make examples fail, and they're explained in [](./differences.md).

## Notes on micromark

- micromark's API is low level. We learned it by copying patterns from micromark's own constructs and from `micromark-extension-directive`.
- TypeScript needs each new token type declared on `TokenTypeMap` in `micromark-util-types`.
- micromark checks for a list before it tries our constructs. So `+ + +` (with spaces) is a list here, and a block break in mystmd. Plain `+++` works.
- `npm test` uses vitest, which loads micromark's development build. That build checks that tokenizers follow micromark's rules, and the normal build doesn't.

## Not supported yet

mystmd's parser accepts these, but no spec example tests them.
Each effort estimate is compared to the constructs above.

- Inline options, like `` {sub .class #id}`2` `` or ```` ```{note .class} ````. Small: adapt the attribute parser in `micromark-extension-directive`.
- YAML options in a `---` block at the start of a directive. Small, but there are no exact positions for values inside YAML.
- A colon fence without `{name}`, like `:::note`, which mystmd turns into a code block. Small.
- Math environments like `\begin{equation}`. Small: one fence-like block construct.
- Dollar math, where `$$ x $$` on one line is display math and `$$ … $$ (eq1)` has a label. Medium: adapt `micromark-extension-math`.
- Definition lists. Medium: `micromark-extension-definition-list` exists, but its node names differ from mystmd's.
- Citations like `@doe2020` and `[@doe2020; @roe]`. Medium to large: `[` already starts a link in CommonMark, so this has to work with micromark's link handling.
