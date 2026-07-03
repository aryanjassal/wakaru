import type { SavedWord } from '@/core/types.js';
import type { ClientConfig } from '../schema/config.js';

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDirectory, resolveUserPath } from '../utils.js';

const EXPORT_FILE = 'export.tsv';

type InheritedExportField = Extract<
  ClientConfig['export']['fields'][number],
  { inherit: unknown }
>;

function sanitiseField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, '\\n').trim();
}

function inheritedValue(word: SavedWord, field: InheritedExportField): string {
  switch (field.inherit) {
    case 'id':
      return word.id;
    case 'expression':
      return word.expression;
    case 'reading':
      return word.reading;
    case 'meaning':
      return word.meaning;
    case 'contextMeaning':
      return word.contextMeaning;
    case 'partOfSpeech':
      return word.partOfSpeech;
    case 'exampleJapanese':
      return word.exampleJapanese;
    case 'exampleEnglish':
      return word.exampleEnglish;
    case 'tags':
      return word.tags.join(' ');
    case 'sourceText':
      return word.sourceText;
    case 'createdAt':
      return word.createdAt;
    default:
      return field.inherit satisfies never;
  }
}

function fieldValue(
  word: SavedWord,
  field: ClientConfig['export']['fields'][number]
): string {
  return 'inherit' in field
    ? inheritedValue(word, field)
    : (word.exportFields[field.key]?.trim() ?? '');
}

function serialise(config: ClientConfig, words: readonly SavedWord[]): string {
  return words
    .map((word) =>
      config.export.fields
        .map((field) => sanitiseField(fieldValue(word, field)))
        .join('\t')
    )
    .join('\n');
}

export async function writeTsvExport(
  config: ClientConfig,
  directory: string,
  words: readonly SavedWord[]
): Promise<string> {
  const exportPath = await ensureDirectory(directory);
  const path = join(exportPath, EXPORT_FILE);
  await writeFile(path, `${serialise(config, words)}\n`, 'utf8');
  return path;
}

export function tsvExportPath(directory: string): string {
  return join(resolveUserPath(directory), EXPORT_FILE);
}
