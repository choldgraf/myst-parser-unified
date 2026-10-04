import type { Root } from 'mdast';
import { fromMarkdown, type Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { mathFromMarkdown } from 'mdast-util-math';
import { frontmatter } from 'micromark-extension-frontmatter';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import { math } from 'micromark-extension-math';
import type { Extension } from 'micromark-util-types';
import { blocks, blocksFromMarkdown } from './blocks.ts';
import { directive, directiveFromMarkdown } from './directives.ts';
import { role, roleFromMarkdown } from './roles.ts';

// Each syntax has a micromark extension, which tokenizes it, and an mdast extension, which turns its tokens into nodes
const syntaxes: [Extension, FromMarkdownExtension][] = [
  [frontmatter(), frontmatterFromMarkdown()],
  [gfmFootnote(), gfmFootnoteFromMarkdown()],
  [gfmTable(), gfmTableFromMarkdown()],
  [gfmTaskListItem(), gfmTaskListItemFromMarkdown()],
  [math(), mathFromMarkdown()],
  [role(), roleFromMarkdown()],
  [directive(), directiveFromMarkdown()],
  [blocks(), blocksFromMarkdown()],
];

/** Parse MyST markdown to mdast */
export function parse(src: string): Root {
  return fromMarkdown(src, {
    extensions: syntaxes.map(([micromark]) => micromark),
    mdastExtensions: syntaxes.map(([, mdast]) => mdast),
  });
}

/** remark plugin: parse MyST, like `unified().use(remarkParse).use(remarkMyst)` */
export function remarkMyst(this: { data(): Record<string, any> }) {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(...syntaxes.map(([micromark]) => micromark));
  (data.fromMarkdownExtensions ??= []).push(...syntaxes.map(([, mdast]) => mdast));
}
