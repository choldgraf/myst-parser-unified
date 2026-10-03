# Phase 3: directives

The question for this phase: can we parse a directive's header, options and body, and get positions right inside the body?

We planned this as a tree transform on code blocks, and to leave colon fences for a later phase.
Instead, one micromark extension handles backtick, tilde and colon fences, because mystmd treats them all the same way.

## What we built

`src/directives.ts` has a micromark tokenizer and an mdast handler, like `src/roles.ts`.
The handler builds the same tree as mystmd's parser does before directives run: a `mystDirective` node with `mystDirectiveArg`, `mystOption` and `mystDirectiveBody` children.

The scoreboard now runs mystmd's own `applyDirectives` on our tree, then `applyRoles`, because the spec expects the tree after both run.
It also makes the same changes to directive nodes that mystmd's spec test makes (see `normalize()` in `test/spec.ts`).
Almost all of the `directives.*` examples now match (see the score table on the [home page](./index.md)).
`test/parse.test.ts` also compares edge cases with mystmd's parser, because the spec only has simple directives.

## How it works

- The opening fence works like a fenced code block, followed by `{name}` and an optional argument.
  It runs before CommonMark's fenced code, which takes over when there's no `{name}`.
- The argument and each option value (like `:class: tip`) are marked as *text content*, so micromark parses them as inline markdown in place, like a role's body.
- The body is marked as *document content*, so micromark parses it as markdown in place, nested directives and all.
  This is the same trick `micromark-extension-directive` uses for `:::name` containers, and its code was the model for ours.
- So every node in a directive has an exact position, including inside block quotes and lists.
  mystmd parses each of these parts again as a separate string, so it only knows their line offset.

## What we learned

- This was the "right way" all along, and not much harder than a tree transform would have been.
  A transform would have needed to parse the body again and map positions back by hand, which we already saw go wrong for roles.
- Most of the tokenizer is copied structure: closing fences, lazy lines, and line indents work the same as in fenced code and `micromark-extension-directive`.
  The MyST-specific parts are small: the `{name}` header, and option lines before the body.
- Colon fences came for free, which answers most of the Phase 4 question.
- The body's `value` needs the fence's indent removed from each line, like a fenced code block does.
  The handler can't see that indent, so the tokenizer stores it on the body's token.
- Two of `applyDirectives`' inputs are only defined by mystmd's code: options are collected on the directive too (repeated `class` values add up, otherwise the first one wins), and a body of only blank lines is no body.

## What's still different from the spec

- `{list-table}` cells: the spec expects items in tight lists to hold text directly, with no paragraph.
  mystmd's spec test turns `listItemParagraphs` off to get this, and the same goes for every tight list in the spec.
  mdast always wraps list item content in a paragraph, so we leave these failing.
- The other directive and `references.*` examples that fail do so because of tree differences from [Phase 1](./phase-1.md), like `title: null` on links.

## Not supported yet

No spec example uses these, but mystmd's parser accepts them:

- YAML options in a `---` block at the start of the body.
- Inline options in the braces, like ```` ```{note .class} ````.
- A colon fence with no `{name}`, like `:::note`, which mystmd turns into a code block.
- The `tight` field that mystmd adds to directives that touch the line before or after.
  mystmd's spec test removes it, so the scoreboard does too.
