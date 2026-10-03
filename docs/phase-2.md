# Phase 2: roles

The question for this phase: how much work is one piece of MyST syntax as a micromark extension?
We picked roles, like `` {sub}`2` ``.

## What we built

`src/roles.ts` is one small file with two parts:

- a micromark tokenizer, which finds roles in inline text;
- an mdast handler, which builds the same tree as mystmd's parser does before roles run: a `mystRole` node with a `mystRoleBody` child.

The spec expects the tree *after* roles run, so the scoreboard runs mystmd's own `applyRoles` on our tree before comparing.
All of the `roles.*` examples now match (see the score table on the [home page](./index.md)).
`test/parse.test.ts` also compares role edge cases with mystmd's parser, because the spec only has simple roles.

## How it works

- The tokenizer matches `{name}`, then a run of backticks.
  Like a code span, the body ends at a run of exactly as many backticks as it started with.
- Each line of the body is marked as *text content*, so micromark parses it as inline markdown in place.
  This is the same trick that `micromark-extension-directive` uses for the `[label]` of a directive.
- So the nodes in a role's body have exact positions, even when the body spans lines inside a list or block quote.
  mystmd parses the body again as a separate string, which is why its nested parses only know a line offset (mystmd#2864).

## What we learned

- Most of the work is the tokenizer's state machine.
  micromark's API is low level, and the way to learn it is to copy patterns from existing extensions.
- Our first attempt was shorter.
  It reused CommonMark's code span tokenizer for the backticks (like [unified-myst](https://github.com/executablebooks/unified-myst/tree/main/packages/role-extension)), then parsed the body again and shifted its positions.
  But positions were wrong after the first line inside a container, and it needed a regex to read the role back out of the source.
  Parsing the body in place removed both problems.
- Two small details make the body match mystmd's: whitespace at the start of each body line is skipped, like in a paragraph, and `canContainEols` keeps line endings in the body as text.
- TypeScript needs the new token types declared on `TokenTypeMap` in `micromark-util-types`.
- `applyRoles` isn't exported from `myst-parser`, so we import its file by path, with `myst-parser` pinned to an exact version.
  Exporting `applyRoles` and `applyDirectives` from `packages/myst-parser/src/index.ts` in mystmd would fix that.

## Not supported yet

No spec example uses these, but mystmd's parser accepts them:

- inline options, like `` {sub .class #id}`2` ``;
- spaces inside the braces, like `` { sub }`2` ``;
- names with spaces, like `` {a b}`2` ``, which mystmd turns into a `mystRoleError`.

`micromark-extension-directive` already parses `{#id .class key=value}` attributes, so it's a good place to start for inline options.

The `references.*` examples that still fail do so because of backtick directives and targets, not roles.
