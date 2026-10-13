import type { Root } from 'mdast';

/**
 * Change our mdast tree, in place, into the tree mystmd's parser builds, before directives and roles run.
 * docs/differences.md lists what it changes, and what it can't.
 */
export function toMystmd(tree: Root): Root {
  return adapt(tree);
}

/** Adapt a node's children, then the node, and return the node that replaces it */
function adapt(node: any): any {
  if (node.children) node.children = node.children.map(adapt);
  if (node.type === 'yaml') Object.assign(node, { type: 'code', lang: 'yaml' });
  if (node.type === 'code') {
    node.lang ??= '';
    delete node.meta;
  }
  return node;
}
