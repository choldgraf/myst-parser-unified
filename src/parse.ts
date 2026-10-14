import type { BlockContent, DefinitionContent, Literal, Node, Parent, PhrasingContent, Root } from 'mdast';
import { fromMarkdown, type Extension as FromMarkdownExtension } from 'mdast-util-from-markdown';
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter';
import { gfmFootnoteFromMarkdown } from 'mdast-util-gfm-footnote';
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table';
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item';
import { frontmatter } from 'micromark-extension-frontmatter';
import { gfmFootnote } from 'micromark-extension-gfm-footnote';
import { gfmTable } from 'micromark-extension-gfm-table';
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item';
import type { Extension } from 'micromark-util-types';
import { blocks, blocksFromMarkdown } from './blocks.ts';
import { citation, citationFromMarkdown, type Citation } from './citations.ts';
import { definitionList, definitionListFromMarkdown } from './definitionLists.ts';
import { directive, directiveFromMarkdown } from './directives.ts';
import { math, mathFromMarkdown } from './math.ts';
import { role, roleFromMarkdown } from './roles.ts';

export { toMystmd } from './mystmd.ts';

// Each syntax has a micromark extension, which tokenizes it, and an mdast extension, which turns its tokens into nodes
const syntaxes: [Extension, FromMarkdownExtension][] = [
  [frontmatter(), frontmatterFromMarkdown()],
  [gfmFootnote(), gfmFootnoteFromMarkdown()],
  [gfmTable(), gfmTableFromMarkdown()],
  [gfmTaskListItem(), gfmTaskListItemFromMarkdown()],
  [math(), mathFromMarkdown()],
  [role(), roleFromMarkdown()],
  [citation(), citationFromMarkdown()],
  [directive(), directiveFromMarkdown()],
  [blocks(), blocksFromMarkdown()],
  [definitionList(), definitionListFromMarkdown()],
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

// The nodes that the MyST mdast extensions add
declare module 'mdast' {
  interface MystRole extends Parent {
    type: 'mystRole';
    name: string;
    value: string;
    processed: false;
    children: MystRoleBody[];
  }
  interface MystRoleBody extends Parent {
    type: 'mystRoleBody';
    value: string;
    children: PhrasingContent[];
  }
  interface MystDirective extends Parent {
    type: 'mystDirective';
    name: string;
    args?: string;
    options?: Record<string, string | true>;
    value?: string;
    processed: false;
    children: (MystDirectiveArg | MystOption | MystDirectiveBody)[];
  }
  interface MystDirectiveArg extends Parent {
    type: 'mystDirectiveArg';
    value: string;
    children: PhrasingContent[];
  }
  interface MystOption extends Parent {
    type: 'mystOption';
    name: string;
    location: string;
    value: string | true;
    children: PhrasingContent[];
  }
  interface MystDirectiveBody extends Parent {
    type: 'mystDirectiveBody';
    value: string;
    children: (BlockContent | DefinitionContent)[];
  }
  interface Cite extends Node, Citation {
    type: 'cite';
  }
  interface CiteGroup extends Parent {
    type: 'citeGroup';
    kind: 'parenthetical';
    children: Cite[];
  }
  interface MystTarget extends Node {
    type: 'mystTarget';
    label: string;
  }
  interface Comment extends Literal {
    type: 'comment';
  }
  interface BlockBreak extends Node {
    type: 'blockBreak';
    meta?: string;
  }
  interface DefinitionList extends Parent {
    type: 'definitionList';
    children: (DefinitionTerm | DefinitionDescription)[];
  }
  interface DefinitionTerm extends Parent {
    type: 'definitionTerm';
    children: PhrasingContent[];
  }
  interface DefinitionDescription extends Parent {
    type: 'definitionDescription';
    children: (BlockContent | DefinitionContent | PhrasingContent)[];
  }
  interface Math extends Literal {
    type: 'math';
    identifier?: string;
    label?: string;
    html_id?: string;
  }
  interface InlineMath extends Literal {
    type: 'inlineMath';
  }
  interface PhrasingContentMap {
    mystRole: MystRole;
    inlineMath: InlineMath;
    math: Math;
    cite: Cite;
    citeGroup: CiteGroup;
  }
  interface BlockContentMap {
    mystDirective: MystDirective;
    math: Math;
    mystTarget: MystTarget;
    comment: Comment;
    blockBreak: BlockBreak;
    definitionList: DefinitionList;
  }
  interface RootContentMap {
    mystRole: MystRole;
    inlineMath: InlineMath;
    math: Math;
    mystRoleBody: MystRoleBody;
    cite: Cite;
    citeGroup: CiteGroup;
    mystDirective: MystDirective;
    mystDirectiveArg: MystDirectiveArg;
    mystOption: MystOption;
    mystDirectiveBody: MystDirectiveBody;
    mystTarget: MystTarget;
    comment: Comment;
    blockBreak: BlockBreak;
    definitionList: DefinitionList;
    definitionTerm: DefinitionTerm;
    definitionDescription: DefinitionDescription;
  }
}
