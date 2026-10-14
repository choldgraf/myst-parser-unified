# How it works

`parse()` turns a MyST string into an mdast tree, and `mystParse()` turns it into the tree myst-parser's `mystParse` returns.
Every position comes from micromark: each token records where it starts and ends, and `mdast-util-from-markdown` copies that onto the node it builds.

```{mermaid}
flowchart LR
  src["Markdown string"] --> syntax["micromark, with the micromark extension from each syntax module"]
  syntax -->|tokens| from["mdast-util-from-markdown, with each module's mdast extension"]
  from --> raw["raw tree, from parse() in src/parse.ts"]
  raw --> adapt["toMystmd() in src/mystmd.ts"]
  adapt --> adapted["adapted tree"]
  adapted --> apply["applyDirectives and applyRoles from myst-parser"]
  apply --> out["mystParse() output, from src/mystParse.ts"]
  ref["mystmd's parser and myst-spec's expected trees"] -.-> score["scorers in test/spec.ts, run by scripts/score.ts"]
  raw -.-> score
  adapted -.-> score
  out -.-> score
```

`mystParse()` is `toMystmd(parse(src))` followed by `applyDirectives` and `applyRoles`.
When a directive parses its body, that body goes back through `mystParse()`, with its line numbers shifted to where it sits in the file.

## A worked example

```markdown
(water)=
- H{sub}`2`O
```

`parse()` builds a `mystTarget` node and a list whose paragraph holds a `mystRole` node, with `processed: false` and a `mystRoleBody` child.
Positions come from micromark's tokens, so the role starts at line 2, column 4, and the `2` inside it at column 10.
`toMystmd()` sets the list item's `spread` to `true`, like mystmd.
On other input it renames nodes, like `blockBreak` to `block`, and reshapes them, like turning link references into links.
`applyRoles` runs the `sub` role, which swaps the `mystRoleBody` for a `subscript` node and drops `processed: false`.
`applyDirectives` has nothing to do here, and the target is left for mystmd's later transforms.

## How scoring works

`npm run score` runs `scripts/score.ts`, which runs every scorer in `test/spec.ts` on each myst-spec example that has MyST source.
`raw` and `adapted` compare `parse()` and `toMystmd(parse())` with mystmd's parser, and `dropin` compares our `mystParse` with myst-parser's.
`transformed` runs mystmd's directives and roles on `parse()`, and `ceiling` runs myst-parser's `mystParse`, and both compare with the spec's expected tree.
It writes each scorer's passing examples to `scoreboard.json`, and the data for the [score table](index.md#score-per-file) to `docs/data/`.
`test/scoreboard.test.ts` fails if any example listed in `scoreboard.json` stops passing.
CI runs `npm test`, `npm run typecheck`, `npm run build` and `npm run score`, and fails if `scoreboard.json` then differs from the committed file.

## To add a syntax

1. Write `src/<name>.ts`, exporting a micromark extension that tokenizes the syntax and an mdast extension that builds the nodes mystmd builds.
2. Add the pair to the `syntaxes` array in `src/parse.ts`, and declare any new node types in its `declare module 'mdast'` block.
3. Write `test/<name>.test.ts`, which compares `parse()` with mystmd's live parse from `mystmd()` in `test/spec.ts`, like `test/citations.test.ts` does.
4. If the tree can't match mystmd's, say why in [Differences from mystmd](differences.md).
5. Run `npm run score`, and commit the updated `scoreboard.json`.

Then check [What must stay in sync by hand](index.md#what-must-stay-in-sync-by-hand) for anything else the syntax touches.

## The modules

The parser is `mdast-util-from-markdown` with extensions for MyST.
micromark splits the source into tokens, and `mdast-util-from-markdown` turns those tokens into an mdast tree.
Each of `src/roles.ts`, `src/directives.ts`, `src/blocks.ts`, `src/citations.ts`, `src/definitionLists.ts` and `src/math.ts` exports two extensions:

- a **micromark extension**, which tells micromark how to find the syntax;
- an **mdast extension**, which builds the same nodes that mystmd's parser builds.

[`src/parse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/parse.ts) puts them together with micromark's extensions for front matter, GFM footnotes, GFM tables and GFM task lists, as `parse()` and the `remarkMyst` plugin.
`toMystmd()` in [`src/mystmd.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/mystmd.ts) changes that tree into the shape mystmd's parser builds.
[Differences from mystmd](differences.md) lists what it changes.
`mystParse()` in [`src/mystParse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/mystParse.ts) is a drop-in for myst-parser's `mystParse`, imported from `myst-parser-unified/mystmd` and for Node only.
[What we learned](findings.md) says how close it gets.
Every node gets an exact line, column and offset, including in nested content.

## Roles

[`src/roles.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/roles.ts) parses roles like `` {sub}`2` ``.
A role is `{name}` followed by a body in backticks.
Spaces inside the braces are fine, like `` { sub }`2` ``.
Like inline code, the body ends at a run of exactly as many backticks as it started with.

The body is parsed as inline markdown where it sits in the document, so `` {sub}`*2*` `` has an `emphasis` node inside it.
mystmd parses the body again as a separate string, so positions inside it count from the start of the body, not the document.

## Directives

[`src/directives.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/directives.ts) parses directives like this:

````markdown
```{note} An argument
:class: tip

The body.
```
````

The braces of a directive or a role can have spaces inside, and inline options after the name, like ```` ```{note .dropdown #my-label open=true} ````.
Like in mystmd, each inline option is a `mystOption` node with `location: "inline"`, and `#my-label` is the `label` option.
A directive with only options, like `{.dropdown}`, is a `div`.
`factoryHeader` in [`src/shared.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/shared.ts) parses the braces for both, and [Differences from mystmd](differences.md#inline-options) says where it differs.

The fence can use backticks, tildes or colons, and works like a fenced code block.
A fence without `{name}` is a code block, and like in mystmd that includes a colon fence like `:::note`.
Option lines like `:class: tip` come right after the opening fence.
Or the first body line can be `---`, followed by `class: tip` lines and another `---`, which is a YAML block of options.
We read only flat `key: value` lines in that block.
[Differences from mystmd](differences.md#yaml-options) says why.

The argument and option values are parsed as inline markdown, and the body as block markdown, all in place.
So nested directives work, and every node has an exact position.
The tokenizer is modeled on the `:::name` containers in [`micromark-extension-directive`](https://github.com/micromark/micromark-extension-directive).

## Targets, comments and block breaks

[`src/blocks.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/blocks.ts) parses three constructs that each take up a whole line:

- targets, like `(my-label)=`, which label the next block so you can link to it;
- comments, like `% a comment`, where several `%` lines in a row make one comment;
- block breaks, like `+++` or `+++ {"meta": "data"}`, which split a page into blocks.

Like a heading, each one can come right after a line of text, without a blank line between.

## Citations

[`src/citations.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/citations.ts) parses citations like `@key`, `@key [p. 3]` and `[see @key, p. 3; -@other]`.
`@key` is a `cite` node, and brackets make a `citeGroup` node with a `cite` for each part between `;`.
Like mystmd, a key must come at the start of a line or after a non-alphanumeric character, so `a@b.com` isn't a citation, and neither is an `@` in a URL-like word such as `https://x.com/@user`.
Inside the text of a link or image, citations are text, so `[@user](url)` is a link.
The comment at the top of the file says how it matches mystmd's own patterns.

## Definition lists

[`src/definitionLists.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/definitionLists.ts) parses definition lists like this:

```markdown
Term
: A description.
: Another description.

Another term

~ A description after a blank line.
```

A description starts with `:` or `~` and a space, and lines indented two spaces more than its marker continue it.
Each description is a micromark container, like a list item, so it can hold paragraphs, lists, code and directives, and lazy lines work the same way.
A term is a paragraph of one line, right before a description or before one blank line and a description.
A description right after another one needs no term.
Like mystmd, a list is loose if a description has a blank line inside it or before the next description.
In a tight list, a description's text goes straight in the `definitionDescription` node, without a paragraph.

## Math

[`src/math.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/math.ts) parses dollar math and amsmath environments, with the same rules as mystmd's `markdown-it-dollarmath` and `markdown-it-amsmath`:

- `$x$` is an `inlineMath` node, and `$$x$$` inside a paragraph is a `math` node in the paragraph.
- A `$$` block ends at the first line that ends with `$$`, so `$$ x $$` on one line is a block too.
  A label after the closing `$$`, like `$$ … $$ (eq1)`, gives the node a `label`, `identifier` and `html_id`, with spaces in the label turned into `-`.
  A `$$` block can't have a blank line in it or interrupt a paragraph.
- `\begin{equation}` and the other top-level environments, like `align` and `pmatrix`, are a `math` node whose value keeps the `\begin` and `\end` lines.
  They can have blank lines in them and interrupt a paragraph, and mystmd drops any text after the `\end{…}`.

## Notes on micromark

- micromark's API is low level.
  Its own constructs and `micromark-extension-directive` are good patterns to copy.
- TypeScript needs each new token type declared on `TokenTypeMap` in `micromark-util-types`.
- micromark checks for a list before it tries our constructs.
  So `+ + +` is a list here, and a block break in mystmd.
  Plain `+++` works in both.
- `npm test` uses vitest, which loads micromark's development build.
  That build checks that tokenizers follow micromark's rules, and the normal build doesn't.
- micromark tries a new container twice: once to check, and again after closing the paragraph before it.
  So a definition description can't read its term from the paragraph before it, which changes between the two tries.
  Instead, a construct that never matches records where each paragraph starts, and the description looks that up.
- A token that spans lines needs a token around each line's characters and each line ending.
  Without them, micromark loops forever when it splits the token back into lines.
