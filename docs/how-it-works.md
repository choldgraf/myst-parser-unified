# How it works

The parser is `mdast-util-from-markdown` with extensions for MyST.
micromark splits the source into tokens, and `mdast-util-from-markdown` turns those tokens into an mdast tree.
Each of `src/roles.ts`, `src/directives.ts`, `src/blocks.ts` and `src/citations.ts` exports two extensions:

- a **micromark extension**, which tells micromark how to find the syntax;
- an **mdast extension**, which builds the same nodes that mystmd's parser builds.

[`src/parse.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/parse.ts) puts them together, as `parse()` and the `remarkMyst` plugin.
Every node gets an exact line, column and offset, including in nested content, so tools like editors can point at the right spot in the source.

## Roles

[`src/roles.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/roles.ts) parses roles like `` {sub}`2` ``.
A role is `{name}` followed by a body in backticks.
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

## Citations

[`src/citations.ts`](https://github.com/choldgraf/myst-parser-unified/blob/main/src/citations.ts) parses citations like `@key`, `@key [p. 3]` and `[see @key, p. 3; -@other]`.
`@key` is a `cite` node, and brackets make a `citeGroup` node with a `cite` for each part between `;`.
Like mystmd, a key must come at the start of a line or after a non-alphanumeric character, so `a@b.com` isn't a citation, and neither is an `@` in a URL-like word such as `https://x.com/@user`.
Inside the text of a link or image, citations are text, so `[@user](url)` is a link.
The comment at the top of the file says how it matches mystmd's own patterns.

## Notes on micromark

- micromark's API is low level.
  Its own constructs and `micromark-extension-directive` are good patterns to copy.
- TypeScript needs each new token type declared on `TokenTypeMap` in `micromark-util-types`.
- micromark checks for a list before it tries our constructs.
  So `+ + +` is a list here, and a block break in mystmd.
  Plain `+++` works in both.
- `npm test` uses vitest, which loads micromark's development build.
  That build checks that tokenizers follow micromark's rules, and the normal build doesn't.

## Not supported yet

mystmd's parser accepts these, but no myst-spec example uses them, so the score doesn't count them.
Effort is relative to the roles, directives and blocks above.

- Spaces inside a role's braces, like `` { sub }`x` ``. Small.
- Inline options, like `` {sub .class #id}`2` `` or ```` ```{note .class} ````. Small: adapt the attribute parser in `micromark-extension-directive`.
- YAML options in a `---` block at the start of a directive. Small, but there are no exact positions for values inside YAML.
- A colon fence without `{name}`, like `:::note`, which mystmd turns into a code block. Small.
- Math environments like `\begin{equation}`. Small: one fence-like block construct.
- Two dollar-math forms: `$$ x $$` on one line as display math, and `$$ … $$ (eq1)` with a label. Medium: adapt `micromark-extension-math`.
- Definition lists. Medium: `micromark-extension-definition-list` exists, but its node names differ from mystmd's.
