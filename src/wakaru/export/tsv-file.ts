import type { SavedWord } from '../types.js';
import type { ClientConfig } from '../schema/config.js';

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureDirectory, resolveUserPath } from '../utils.js';
import { serialiseTsv, TSV_EXPORT_FILE } from './tsv.js';

export async function writeTsvExport(
  config: ClientConfig,
  directory: string,
  words: readonly SavedWord[]
): Promise<string> {
  const exportPath = await ensureDirectory(directory);
  const path = join(exportPath, TSV_EXPORT_FILE);
  await writeFile(path, `${serialiseTsv(config, words)}\n`, 'utf8');
  return path;
}

export function tsvExportPath(directory: string): string {
  return join(resolveUserPath(directory), TSV_EXPORT_FILE);
}
