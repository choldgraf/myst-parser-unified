import type { Root } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
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

/** Parse MyST markdown to mdast */
export function parse(src: string): Root {
  return fromMarkdown(src, {
    extensions: [frontmatter(), gfmFootnote(), gfmTable(), gfmTaskListItem(), math()],
    mdastExtensions: [
      frontmatterFromMarkdown(),
      gfmFootnoteFromMarkdown(),
      gfmTableFromMarkdown(),
      gfmTaskListItemFromMarkdown(),
      mathFromMarkdown(),
    ],
  });
}
