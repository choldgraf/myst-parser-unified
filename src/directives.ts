// MyST directives, like ```{note} with backtick, tilde or colon fences, as a micromark extension.
// The fence works like a fenced code block, and micromark itself parses the body as markdown, so its nodes get exact positions.
// Modeled on micromark-extension-directive's container (MIT).
import type { CompileContext, Extension as FromMarkdownExtension, Token } from 'mdast-util-from-markdown';
import { factorySpace } from 'micromark-factory-space';
import { markdownLineEnding, markdownLineEndingOrSpace, markdownSpace } from 'micromark-util-character';
import { codes, constants, types } from 'micromark-util-symbol';
import type {
  Code,
  Construct,
  Effects,
  Extension,
  State,
  TokenizeContext,
  Token as MicromarkToken,
  TokenType,
} from 'micromark-util-types';
import { atLineEnd, current, exit, factoryHeader, nonLazyLine } from './shared.ts';

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    mystDirective: 'mystDirective';
    mystDirectiveFence: 'mystDirectiveFence';
    mystDirectiveSequence: 'mystDirectiveSequence';
    mystDirectiveMarker: 'mystDirectiveMarker';
    mystDirectiveName: 'mystDirectiveName';
    mystDirectiveArg: 'mystDirectiveArg';
    mystDirectiveBody: 'mystDirectiveBody';
    mystOptionsDelimiter: 'mystOptionsDelimiter';
  }
  interface Token {
    /** The indent of a directive's fence, which its body's lines lose */
    _indent?: number;
  }
}

/** micromark extension: a fence of three or more backticks, tildes or colons, followed by `{name}` */
export function directive(): Extension {
  const construct: Construct = { name: 'mystDirective', tokenize: tokenizeDirective, concrete: true };
  // These run before CommonMark's fenced code, which takes over when `{name}` is missing.
  // `colonCode` does the same for colons.
  return { flow: { [codes.graveAccent]: construct, [codes.tilde]: construct, [codes.colon]: [construct, colonCode] } };
}

const option: Construct = { tokenize: tokenizeOption, partial: true };
const yamlOption: Construct = { tokenize: (effects, ok, nok) => tokenizeOption(effects, ok, nok, true), partial: true };
const yamlDelimiter: Construct = { tokenize: tokenizeYamlDelimiter, partial: true };

function tokenizeDirective(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const initialSize = fenceIndent(self);
  let closingFence: Construct;
  const yamlOptions: Construct = { tokenize: tokenizeYamlOptions, partial: true };
  const blockLine: Construct = { tokenize: tokenizeBlockLine, partial: true };
  let marker: Code;
  let sizeOpen = 0;
  // Options can only come right after the opening fence, before the body, as `:key:` lines or one YAML block
  let inBody = false;
  let options: 'colon' | 'yaml' | undefined;
  let previous: MicromarkToken | undefined;
  return start;

  function start(code: Code) {
    marker = code;
    effects.enter('mystDirective');
    effects.enter('mystDirectiveFence');
    effects.enter('mystDirectiveSequence');
    return sequenceOpen(code);
  }

  function sequenceOpen(code: Code): State | undefined {
    if (code === marker) {
      sizeOpen++;
      effects.consume(code);
      return sequenceOpen;
    }
    if (sizeOpen < constants.codeFencedSequenceSizeMin) return nok(code);
    effects.exit('mystDirectiveSequence');
    closingFence = factoryClosingFence(marker, sizeOpen, 'mystDirectiveFence', 'mystDirectiveSequence');
    return factorySpace(effects, nameOpen, types.whitespace)(code);
  }

  function nameOpen(code: Code) {
    if (code !== codes.leftCurlyBrace) return nok(code);
    effects.enter('mystDirectiveMarker');
    effects.consume(code);
    effects.exit('mystDirectiveMarker');
    return factoryHeader(effects, factorySpace(effects, argStart, types.whitespace), nok, 'mystDirectiveName', 'mystDirectiveMarker');
  }

  // The rest of the opening line is the argument, parsed as inline markdown
  function argStart(code: Code) {
    if (atLineEnd(code)) return openEnd(code);
    effects.enter('mystDirectiveArg');
    effects.enter(types.chunkText, { contentType: constants.contentTypeText });
    return arg(code);
  }

  function arg(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.chunkText);
      effects.exit('mystDirectiveArg');
      return openEnd(code);
    }
    // Like the info string of a fenced code block, a backtick fence's argument can't have backticks
    if (code === codes.graveAccent && marker === codes.graveAccent) return nok(code);
    effects.consume(code);
    return arg;
  }

  function openEnd(code: Code) {
    effects.exit('mystDirectiveFence');
    if (self.interrupt) return ok(code);
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function lineStart(code: Code) {
    const content = initialSize
      ? factorySpace(effects, lineContent, types.linePrefix, initialSize + 1)
      : lineContent;
    return effects.check(closingFence, close, content)(code);
  }

  // The closing fence comes after the body, not in it
  function close(code: Code) {
    if (inBody) effects.exit('mystDirectiveBody');
    return effects.attempt(closingFence, done, nok)(code);
  }

  function lineContent(code: Code) {
    if (!inBody && !options && code === codes.dash) return effects.attempt(yamlOptions, yamlEnd, bodyStart)(code);
    if (!inBody && options !== 'yaml' && code === codes.colon) return effects.attempt(option, optionEnd, bodyStart)(code);
    return bodyStart(code);
  }

  function yamlEnd(code: Code) {
    options = 'yaml';
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function optionEnd(code: Code) {
    options = 'colon';
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function bodyStart(code: Code) {
    // An empty body at the end of the document would be an empty token, which micromark can't slice
    if (code === codes.eof) return after(code);
    if (!inBody) {
      inBody = true;
      // The mdast handler needs this to remove the indent from `value`
      effects.enter('mystDirectiveBody', { _indent: initialSize });
    }
    return chunkStart(code);
  }

  // Each line of the body is a chunk of document, linked to the one before, for micromark to parse later
  function chunkStart(code: Code) {
    if (markdownLineEnding(code)) return effects.check(nonLazyLine, chunkNonLazyStart, after)(code);
    return chunkNonLazyStart(code);
  }

  function chunkNonLazyStart(code: Code) {
    const token = effects.enter(types.chunkDocument, { contentType: constants.contentTypeDocument, previous });
    if (previous) previous.next = token;
    previous = token;
    return chunkContinue(code);
  }

  function chunkContinue(code: Code): State | undefined {
    if (code === codes.eof) {
      chunkExit();
      return after(code);
    }
    if (markdownLineEnding(code)) return effects.check(nonLazyLine, chunkLineEnd, chunkLazyEnd)(code);
    effects.consume(code);
    return chunkContinue;
  }

  function chunkLineEnd(code: Code) {
    effects.consume(code);
    chunkExit();
    return lineStart;
  }

  function chunkLazyEnd(code: Code) {
    chunkExit();
    return after(code);
  }

  function chunkExit() {
    const token = effects.exit(types.chunkDocument);
    self.parser.lazy[token.start.line] = false;
  }

  // Ended without a closing fence: the directive ends where the body does
  function after(code: Code) {
    if (inBody) effects.exit('mystDirectiveBody');
    return done(code);
  }

  function done(code: Code) {
    effects.exit('mystDirective');
    return ok(code);
  }

  // A YAML block of options, like in mystmd: a `---` line, `key: value` lines, then a `---` line or the end of the directive.
  // mystmd reads the block with js-yaml, which we don't depend on, so this reads only flat `key: value` lines.
  // The value is the raw text after the colon, and docs/differences.md says why that's enough for now.
  // Any other line, like an indented one, a `- item` or a duplicate key, leaves the whole block in the body.
  // Typed values, `|` blocks, lists and nesting need a YAML parser, which could read the block's text from here.
  function tokenizeYamlOptions(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    const self = this;
    const names = new Set<string>();
    return effects.attempt(yamlDelimiter, lineEnd, nok);

    function lineEnd(code: Code): State | undefined {
      if (code === codes.eof) return end(code);
      return effects.check(blockLine, effects.attempt(nonLazyLine, lineStart, nok), end)(code);
    }

    // Like js-yaml, a block with no keys isn't options
    function end(code: Code) {
      return names.size ? ok(code) : nok(code);
    }

    function lineStart(code: Code): State | undefined {
      return initialSize ? factorySpace(effects, line, types.linePrefix, initialSize + 1)(code) : line(code);
    }

    function line(code: Code) {
      if (markdownSpace(code)) return factorySpace(effects, blank, types.whitespace)(code);
      if (atLineEnd(code)) return lineEnd(code);
      return effects.attempt(yamlDelimiter, end, effects.attempt(yamlOption, optionLine, nok))(code);
    }

    function blank(code: Code) {
      return atLineEnd(code) ? lineEnd(code) : nok(code);
    }

    // The option's name is the text before its colon
    function optionLine(code: Code) {
      const name = self.sliceSerialize(self.events[self.events.length - 1][1]).split(':')[0];
      if (names.has(name)) return nok(code);
      names.add(name);
      return lineEnd(code);
    }
  }

  // The next line is in the directive: not lazy, and not its closing fence
  function tokenizeBlockLine(effects: Effects, ok: State, nok: State): State {
    return effects.attempt(nonLazyLine, effects.check(closingFence, nok, ok), nok);
  }
}

// A colon fence without `{name}`, like `:::note`, is a code block in mystmd, so it's a `codeFenced` here too.
// micromark's own `codeFenced` only takes backticks and tildes, so this is a copy of it for colons.
// Its production build would accept a colon marker, but its dev build, which the tests load, asserts on it, so it can't be reused.
const colonCode: Construct = { name: 'colonCode', tokenize: tokenizeColonCode, concrete: true };

function tokenizeColonCode(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  const self = this;
  const initialSize = fenceIndent(self);
  let closing: Construct;
  let sizeOpen = 0;
  return start;

  function start(code: Code) {
    effects.enter(types.codeFenced);
    effects.enter(types.codeFencedFence);
    effects.enter(types.codeFencedFenceSequence);
    return sequence(code);
  }

  function sequence(code: Code): State | undefined {
    if (code === codes.colon) {
      sizeOpen++;
      effects.consume(code);
      return sequence;
    }
    if (sizeOpen < constants.codeFencedSequenceSizeMin) return nok(code);
    effects.exit(types.codeFencedFenceSequence);
    closing = factoryClosingFence(codes.colon, sizeOpen, types.codeFencedFence, types.codeFencedFenceSequence);
    return factorySpace(effects, infoStart, types.whitespace)(code);
  }

  // The first word is the language, and the rest of the line its meta
  function infoStart(code: Code) {
    if (atLineEnd(code)) return openEnd(code);
    effects.enter(types.codeFencedFenceInfo);
    effects.enter(types.chunkString, { contentType: constants.contentTypeString });
    return info(code);
  }

  function info(code: Code): State | undefined {
    if (atLineEnd(code) || markdownSpace(code)) {
      effects.exit(types.chunkString);
      effects.exit(types.codeFencedFenceInfo);
      return factorySpace(effects, metaStart, types.whitespace)(code);
    }
    effects.consume(code);
    return info;
  }

  function metaStart(code: Code) {
    if (atLineEnd(code)) return openEnd(code);
    effects.enter(types.codeFencedFenceMeta);
    effects.enter(types.chunkString, { contentType: constants.contentTypeString });
    return meta(code);
  }

  function meta(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.chunkString);
      effects.exit(types.codeFencedFenceMeta);
      return openEnd(code);
    }
    effects.consume(code);
    return meta;
  }

  function openEnd(code: Code) {
    effects.exit(types.codeFencedFence);
    return self.interrupt ? ok(code) : lineEnd(code);
  }

  function lineEnd(code: Code): State | undefined {
    return effects.attempt(nonLazyLine, lineStart, after)(code);
  }

  function lineStart(code: Code) {
    return effects.attempt(closing, after, contentStart)(code);
  }

  function contentStart(code: Code) {
    return initialSize ? factorySpace(effects, content, types.linePrefix, initialSize + 1)(code) : content(code);
  }

  function content(code: Code) {
    if (atLineEnd(code)) return lineEnd(code);
    effects.enter(types.codeFlowValue);
    return value(code);
  }

  function value(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.codeFlowValue);
      return lineEnd(code);
    }
    effects.consume(code);
    return value;
  }

  function after(code: Code) {
    effects.exit(types.codeFenced);
    return ok(code);
  }
}

/** Like in a fenced code block, lines lose up to as much indent as the opening fence has */
function fenceIndent(self: TokenizeContext) {
  const tail = self.events[self.events.length - 1];
  return tail && tail[1].type === types.linePrefix ? tail[2].sliceSerialize(tail[1], true).length : 0;
}

/** A closing fence of at least `size` `marker`s and then only whitespace, as `fenceType` and `sequenceType` tokens */
function factoryClosingFence(marker: Code, size: number, fenceType: TokenType, sequenceType: TokenType): Construct {
  return { tokenize, partial: true };

  function tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    let count = 0;
    const indentMax = this.parser.constructs.disable.null?.includes('codeIndented') ? undefined : constants.tabSize;
    return factorySpace(effects, start, types.linePrefix, indentMax);

    function start(code: Code) {
      effects.enter(fenceType);
      effects.enter(sequenceType);
      return sequence(code);
    }

    function sequence(code: Code): State | undefined {
      if (code === marker) {
        count++;
        effects.consume(code);
        return sequence;
      }
      if (count < size) return nok(code);
      effects.exit(sequenceType);
      return factorySpace(effects, end, types.whitespace)(code);
    }

    function end(code: Code) {
      if (!atLineEnd(code)) return nok(code);
      effects.exit(fenceType);
      return ok(code);
    }
  }
}

// An option line, like `:class: tip`, or `class: tip` in a YAML block, whose value is parsed as inline markdown
function tokenizeOption(effects: Effects, ok: State, nok: State, yaml = false): State {
  const isOptionNameChar = (code: Code) => code !== codes.colon && code !== codes.eof && !markdownLineEndingOrSpace(code);
  return start;

  function start(code: Code) {
    effects.enter('mystOption', { _location: yaml ? 'yaml' : 'colon' });
    if (yaml) return nameStart(code);
    effects.enter('mystOptionMarker');
    effects.consume(code); // `:`
    effects.exit('mystOptionMarker');
    return nameStart;
  }

  function nameStart(code: Code) {
    if (!isOptionNameChar(code)) return nok(code);
    effects.enter('mystOptionName');
    return name(code);
  }

  function name(code: Code): State | undefined {
    if (isOptionNameChar(code)) {
      effects.consume(code);
      return name;
    }
    if (code !== codes.colon) return nok(code);
    effects.exit('mystOptionName');
    effects.enter('mystOptionMarker');
    effects.consume(code);
    effects.exit('mystOptionMarker');
    return yaml ? yamlValueStart : factorySpace(effects, valueStart, types.whitespace);
  }

  // In YAML, a colon only starts a value when a space follows it. An empty value is null, which we don't read.
  function yamlValueStart(code: Code) {
    return markdownSpace(code) ? factorySpace(effects, valueStart, types.whitespace)(code) : nok(code);
  }

  function valueStart(code: Code) {
    if (atLineEnd(code)) return yaml ? nok(code) : end(code);
    effects.enter('mystOptionValue');
    effects.enter(types.chunkText, { contentType: constants.contentTypeText });
    return value(code);
  }

  function value(code: Code): State | undefined {
    if (atLineEnd(code)) {
      effects.exit(types.chunkText);
      effects.exit('mystOptionValue');
      return end(code);
    }
    effects.consume(code);
    return value;
  }

  function end(code: Code) {
    effects.exit('mystOption');
    return ok(code);
  }
}

// A `---` line, which opens and closes a YAML block of options
function tokenizeYamlDelimiter(effects: Effects, ok: State, nok: State): State {
  let size = 0;
  return start;

  function start(code: Code) {
    effects.enter('mystOptionsDelimiter');
    return sequence(code);
  }

  function sequence(code: Code): State | undefined {
    if (code === codes.dash && size < 3) {
      size++;
      effects.consume(code);
      return sequence;
    }
    if (size < 3) return nok(code);
    effects.exit('mystOptionsDelimiter');
    return factorySpace(effects, end, types.whitespace)(code);
  }

  function end(code: Code) {
    return atLineEnd(code) ? ok(code) : nok(code);
  }
}

/**
 * mdast extension: the same tree as mystmd's parser, before directives run.
 * `processed: false` tells mystmd's `applyDirectives` to run the directive.
 */
export function directiveFromMarkdown(): FromMarkdownExtension {
  return {
    enter: {
      mystDirective(token) {
        // Like in mystmd, a directive without a name, like `{.class}`, is a `div`
        this.enter({ type: 'mystDirective', name: 'div', processed: false, children: [] }, token);
      },
      mystDirectiveName(token) {
        current(this).name = this.sliceSerialize(token);
      },
      mystDirectiveArg(token) {
        const value = this.sliceSerialize(token).trim();
        current(this).args = value;
        this.enter({ type: 'mystDirectiveArg', value, children: [] }, token);
      },
      mystOption(token) {
        // An inline `.class` or `#id` has no name token
        const first = this.sliceSerialize(token)[0];
        const name = first === '.' ? 'class' : first === '#' ? 'id' : '';
        this.enter({ type: 'mystOption', name, location: token._location!, value: true, children: [] }, token);
      },
      mystOptionName(token) {
        current(this).name = this.sliceSerialize(token);
      },
      mystOptionValue(token) {
        const option = current(this);
        const value = this.sliceSerialize(token);
        // YAML drops the spaces at the end of a value, and mystmd unescapes and trims a quoted inline one
        if (option.location === 'yaml') option.value = value.trimEnd();
        else if (option.location === 'inline') option.value = value.replace(/\\"/g, '"').trim();
        else option.value = value;
      },
      mystDirectiveBody(token) {
        // Like mystmd, remove the fence's indent from each line, then blank lines at the start and whitespace at the end.
        // The first line's indent is already outside the body token.
        const indent = new RegExp(`\n {0,${token._indent}}`, 'g');
        const value = this.sliceSerialize(token).replace(indent, '\n').replace(/^([ \t]*\r?\n)+/, '').trimEnd();
        current(this).value = value;
        this.enter({ type: 'mystDirectiveBody', value, children: [] }, token);
      },
    },
    exit: {
      mystDirective: exit,
      mystDirectiveArg: exit,
      mystOption: exitOption,
      mystDirectiveBody(token) {
        const body = current(this);
        this.exit(token);
        // A body of only blank lines is no body
        if (!body.value) {
          const directive = current(this);
          directive.children.pop();
          delete directive.value;
        }
      },
    },
  };
}

// Also collect a directive's options, like mystmd: `class` values add up, and otherwise the first one wins.
// The node of an inline `#id` is named `id`, but its option is `label`, like in mystmd.
// Roles have inline options too, but mystmd doesn't collect them.
function exitOption(this: CompileContext, token: Token) {
  const { name, value, location } = current(this);
  this.exit(token);
  const directive = current(this);
  if (directive.type !== 'mystDirective') return;
  const key = name === 'id' && location === 'inline' ? 'label' : name;
  directive.options ??= {};
  if (key === 'class' && directive.options.class) directive.options.class += ` ${value}`;
  else if (directive.options[key] === undefined) directive.options[key] = value;
}
