import type { Root } from 'mdast';

/**
 * Change our mdast tree, in place, into the tree mystmd's parser builds, before directives and roles run.
 * docs/differences.md lists what it changes, and what it can't.
 */
export function toMystmd(tree: Root): Root {
  adapt(tree);
  nestBlocks(tree);
  return tree;
}

/** Put the content after each `+++` in a `block` node, which spans the `+++` and that content */
function nestBlocks(tree: any) {
  const children = [];
  let block;
  for (const node of tree.children) {
    if (node.type === 'blockBreak') {
      block = Object.assign(node, { type: 'block', children: [] });
      children.push(block);
    } else if (block) {
      block.children.push(node);
      block.position.end = { ...node.position.end };
    } else {
      children.push(node);
    }
  }
  tree.children = children;
}

/** Adapt a node's children, then the node, and return the node that replaces it */
function adapt(node: any): any {
  if (node.children) node.children = node.children.map(adapt);
  // Percent-encode URLs like markdown-it, which keeps escapes that are already there, like `%20`
  if (node.type === 'link' || node.type === 'image') node.url = encodeURI(node.url).replace(/%25([0-9a-f]{2})/gi, '%$1');
  if (node.type === 'list') node.spread = false;
  if (node.type === 'listItem') node.spread = true;
  if (node.type === 'table') {
    node.children.forEach((row: any, r: number) =>
      row.children.forEach((cell: any, i: number) => {
        if (r === 0) cell.header = true;
        if (node.align[i]) cell.align = node.align[i];
      }),
    );
    delete node.align;
  }
  if (node.type === 'yaml') Object.assign(node, { type: 'code', lang: 'yaml' });
  if (node.type === 'code') {
    node.lang ??= '';
    delete node.meta;
  }
  // A paragraph with only an image becomes the image
  if (node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'image') return node.children[0];
  return node;
}
