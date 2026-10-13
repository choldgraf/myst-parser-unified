import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type { Root } from 'mdast';
import { defaultOptions, type mystParse as mystmdParse } from 'myst-parser';
import { parse, toMystmd } from './parse.ts';

// myst-parser's main entry doesn't export applyDirectives, applyRoles or the VFile it uses,
// and its package.json `exports` blocks importing its files by path, so we load them from its folder.
// That depends on how myst-parser lays out dist/, so package.json pins myst-parser to exactly 1.7.4.
// `fromMystParser` resolves from myst-parser's own folder, so `vfile` is the one myst-parser uses.
const fromMystParser = createRequire(createRequire(import.meta.url).resolve('myst-parser'));
const load = (specifier: string) => import(pathToFileURL(fromMystParser.resolve(specifier)).href);
const { applyDirectives } = await load('./directives.js');
const { applyRoles } = await load('./roles.js');
const { VFile } = await load('vfile');

type Options = Pick<NonNullable<Parameters<typeof mystmdParse>[1]>, 'directives' | 'roles' | 'vfile' | 'markdownit'>;

/**
 * Parse MyST like myst-parser's `mystParse`: our tree, in mystmd's shape, after mystmd's directives and roles run.
 * `markdownit` is accepted and ignored; docs/differences.md says why.
 */
export function mystParse(src: string, opts?: Options): Root {
  return applyDirectivesAndRoles(toMystmd(parse(src)), (source) => mystParse(source, opts), opts);
}

/**
 * Run mystmd's directives and roles on a tree, in place, like myst-parser's `mystParse`.
 * Like myst-parser, it adds mystmd's default directives and roles to the ones you pass.
 * `parseNested` parses a directive's nested content.
 */
export function applyDirectivesAndRoles(tree: Root, parseNested: (src: string) => Root, opts?: Options): Root {
  const vfile = opts?.vfile ?? new VFile();
  applyDirectives(tree, [...defaultOptions.directives, ...(opts?.directives ?? [])], vfile, {
    // Shift the nested tree's line numbers to where it sits in the file
    parseMyst: (source: string, lineOffset = 0) => {
      const nested = parseNested(source);
      const shift = (node: any) => {
        if (node.position) {
          node.position.start.line += lineOffset;
          node.position.end.line += lineOffset;
        }
        node.children?.forEach(shift);
      };
      shift(nested);
      return nested;
    },
  });
  applyRoles(tree, [...defaultOptions.roles, ...(opts?.roles ?? [])], vfile);
  return tree;
}
