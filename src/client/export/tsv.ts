import type { SavedWord } from '../types.js';
import type { ClientConfig } from '../schema/config.js';

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDirectory, resolveUserPath } from '../utils.js';

const EXPORT_FILE = 'export.tsv';

function sanitiseField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, '\\n').trim();
}

function serialise(config: ClientConfig, words: readonly SavedWord[]): string {
  return words
    .map((word) =>
      config.export.fields
        .map((field) =>
          sanitiseField(word.candidate.extension?.exportFields[field.key] ?? '')
        )
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
