import type {
  AnkiFormattingConfig,
  FormattedTextToken,
} from './formatting-types.js';

const ESCAPABLE = new Set(['\\', '*', '_', '{', '}', '|', '<', '>']);

export class FormattingSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormattingSyntaxError';
  }
}

export function escapeFormattedText(value: string): string {
  return value.replace(/[\\*_{}|<>]/g, (character) => `\\${character}`);
}

function readPlainCharacter(value: string, index: number): [string, number] {
  const character = value[index];
  if (character !== '\\') return [character ?? '', index + 1];
  const escaped = value[index + 1];
  if (!escaped || !ESCAPABLE.has(escaped)) {
    throw new FormattingSyntaxError(`Invalid escape at character ${index}.`);
  }
  return [escaped, index + 2];
}

function containsFormatting(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (
      value[index] === '*' ||
      value[index] === '{' ||
      value[index] === '}' ||
      value.startsWith('__', index)
    ) {
      return true;
    }
  }
  return false;
}

function findClosingMarker(
  value: string,
  marker: string,
  start: number
): number {
  for (let index = start; index < value.length; index += 1) {
    if (value[index] === '\\') {
      index += 1;
      continue;
    }
    if (value.startsWith(marker, index)) return index;
  }
  return -1;
}

function unescapeText(value: string): string {
  let result = '';
  for (let index = 0; index < value.length; ) {
    const [character, next] = readPlainCharacter(value, index);
    result += character;
    index = next;
  }
  return result;
}

function styledToken(
  kind: 'bold' | 'italic' | 'underline',
  source: string,
  marker: string,
  start: number
): readonly [FormattedTextToken, number] {
  const contentStart = start + marker.length;
  const end = findClosingMarker(source, marker, contentStart);
  if (end < 0) {
    throw new FormattingSyntaxError(
      `Unclosed ${kind} marker at character ${start}.`
    );
  }
  const raw = source.slice(contentStart, end);
  if (!raw || containsFormatting(raw)) {
    throw new FormattingSyntaxError(
      `${kind} content must be non-empty and cannot contain other formatting.`
    );
  }
  return [{ kind, value: unescapeText(raw) }, end + marker.length];
}

function readingToken(
  source: string,
  start: number
): readonly [FormattedTextToken, number] {
  const end = findClosingMarker(source, '}', start + 1);
  if (end < 0) {
    throw new FormattingSyntaxError(
      `Unclosed reading marker at character ${start}.`
    );
  }
  const raw = source.slice(start + 1, end);
  const separator = findClosingMarker(raw, '|', 0);
  if (
    separator <= 0 ||
    separator === raw.length - 1 ||
    findClosingMarker(raw, '|', separator + 1) >= 0
  ) {
    throw new FormattingSyntaxError(
      'Reading syntax must be {expression|reading}.'
    );
  }
  const expression = raw.slice(0, separator);
  const reading = raw.slice(separator + 1);
  if (containsFormatting(expression) || containsFormatting(reading)) {
    throw new FormattingSyntaxError(
      'Reading content cannot contain other formatting.'
    );
  }
  return [
    {
      kind: 'reading',
      expression: unescapeText(expression),
      reading: unescapeText(reading),
    },
    end + 1,
  ];
}

export function parseFormattedText(
  value: string
): readonly FormattedTextToken[] {
  const tokens: FormattedTextToken[] = [];
  let plain = '';
  const flushPlain = () => {
    if (!plain) return;
    tokens.push({ kind: 'text', value: plain });
    plain = '';
  };

  for (let index = 0; index < value.length; ) {
    let parsed: readonly [FormattedTextToken, number] | null = null;
    if (value.startsWith('**', index)) {
      parsed = styledToken('bold', value, '**', index);
    } else if (value.startsWith('__', index)) {
      parsed = styledToken('underline', value, '__', index);
    } else if (value[index] === '*') {
      parsed = styledToken('italic', value, '*', index);
    } else if (value[index] === '{') {
      parsed = readingToken(value, index);
    } else if (value[index] === '}') {
      throw new FormattingSyntaxError(`Unexpected } at character ${index}.`);
    } else if (
      value[index] === '<' &&
      /^<\/?[A-Za-z][^>]*>/u.test(value.slice(index))
    ) {
      throw new FormattingSyntaxError(
        `HTML is not allowed at character ${index}; use canonical formatting.`
      );
    }

    if (parsed) {
      flushPlain();
      tokens.push(parsed[0]);
      index = parsed[1];
      continue;
    }

    const [character, next] = readPlainCharacter(value, index);
    plain += character;
    index = next;
  }
  flushPlain();
  return tokens;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyTemplate(
  template: string,
  values: Readonly<Record<string, string>>
): string {
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, value),
    template
  );
}

function textToHtml(value: string, lineBreak: string): string {
  return escapeHtml(value).replace(/\r?\n/g, lineBreak);
}

export function formattedTextToAnkiHtml(
  value: string,
  formatting: AnkiFormattingConfig
): string {
  return parseFormattedText(value)
    .map((token) => {
      if (token.kind === 'text') {
        return textToHtml(token.value, formatting.lineBreak);
      }
      if (token.kind === 'reading') {
        return applyTemplate(formatting.readingTemplate, {
          expression: textToHtml(token.expression, formatting.lineBreak),
          reading: textToHtml(token.reading, formatting.lineBreak),
        });
      }
      const template =
        token.kind === 'bold'
          ? formatting.boldTemplate
          : token.kind === 'italic'
            ? formatting.italicTemplate
            : formatting.underlineTemplate;
      return applyTemplate(template, {
        text: textToHtml(token.value, formatting.lineBreak),
      });
    })
    .join('');
}
