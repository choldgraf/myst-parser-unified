import { expect, test } from 'vitest';
import { parse, toMystmd } from '../src/parse.ts';
import { mystmd, normalize } from './spec.ts';

// myst-spec has no definition list examples, so compare these with mystmd's parser.
// toMystmd only adapts the lists and code blocks inside some of these, not the definition lists.
const cases = {
  'one term, one description': 'Term\n: Description',
  'one term, two descriptions': 'Term\n: One\n: Two',
  'two terms before a description, which is a paragraph': 'Term 1\nTerm 2\n: Description',
  'a ~ marker': 'Term\n~ Description',
  'a blank line between term and description': 'Term\n\n: Description',
  'a blank line between descriptions, which makes the list loose': 'Term\n: One\n\n: Two',
  'a description with two paragraphs': 'Term\n: One\n\n  Two',
  'a description with a list, a code block and a directive':
    'Term\n: Text\n  - a\n  - b\n\n  ```python\n  x\n  ```\n\n  ```{note}\n  Body\n  ```',
  'a definition list in a list item': '- Term\n  : Description',
  'a definition list in a directive body': ':::{note}\nTerm\n: Description\n:::',
  'a term line with no description after it': 'Term\nmore text',
  'a marker with no term': ': Description',
  'lazy lines': 'Term\n: One\nlazy\n: Two\nTerm 2\n: Three',
  'two terms with a blank line between them': 'Term 1\n: One\n\nTerm 2\n: Two',
  'a paragraph after the list': 'Term\n: Description\n\nAfter',
  'a marker after a paragraph of two lines': 'Para\nTerm\n: Description',
  'a marker after a heading': '# Heading\n: Description',
  'a marker indented less than the list item before it': '- Term\n: Description',
};

test.each(Object.entries(cases))('%s parses like mystmd', (_, src) => {
  expect(normalize(toMystmd(parse(src)))).toEqual(normalize(mystmd(src, { nestBlocks: false })));
});

// mystmd has no exact columns, so check positions against the source
test('terms and descriptions span their source, with exact positions', () => {
  const src = '- Term *x*\n\n  ~ One\n    more\n\n    Two\n\n  Term 2\n  : Three';
  const list = (parse(src).children[0] as any).children[0].children[0];
  const span = (node: any) => src.slice(node.position.start.offset, node.position.end.offset);
  expect(list.type).toBe('definitionList');
  expect(list.children.map(span)).toEqual(['Term *x*', '~ One\n    more\n\n    Two', 'Term 2', ': Three']);
  expect(list.children[1].position.start).toEqual({ line: 3, column: 3, offset: src.indexOf('~') });
  expect(list.children[3].position.start).toEqual({ line: 9, column: 3, offset: src.indexOf(': Three') });
});
