import type { SavedWord } from '../types.js';
import type { ClientConfig } from '../schema/config.js';

export const TSV_EXPORT_FILE = 'export.tsv';

function sanitiseField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, '\\n').trim();
}

export function serialiseTsv(
  config: ClientConfig,
  words: readonly SavedWord[]
): string {
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
