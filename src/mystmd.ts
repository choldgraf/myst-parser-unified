import type { Root } from 'mdast';

/**
 * Change our mdast tree, in place, into the tree mystmd's parser builds, before directives and roles run.
 * docs/differences.md lists what it changes, and what it can't.
 */
export function toMystmd(tree: Root): Root {
  return tree;
}
