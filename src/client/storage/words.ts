import type { CandidateDefinitionSource } from '@/core/types.js';
import type { ClientCandidate, SavedWord } from '../types.js';
import type { ExportConfig } from '../schema/config.js';
import type { ClientConfig } from '../schema/config.js';
import type {
  ExportSchemaMigration,
  ExportSchemaState,
} from './schema-diff.js';
import { materialiseExportFields } from '../export/fields.js';

export interface WordStore {
  list(): readonly SavedWord[];
  save(word: SavedWord): void;
  isSaved(candidate: ClientCandidate): boolean;
  checkExportSchema(configured: ExportConfig): ExportSchemaState | null;
  applyExportSchema(
    configured: ExportConfig,
    migration: ExportSchemaMigration
  ): void;
  close(): void;
}

export function dictionarySource(
  candidate: ClientCandidate
): Extract<CandidateDefinitionSource, { kind: 'dictionary' }> | null {
  const source = candidate.details?.provenance?.definition;
  return source?.kind === 'dictionary' ? source : null;
}

export function candidateToSavedWord(
  candidate: ClientCandidate,
  sourceText: string,
  config: ClientConfig
): SavedWord {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    id,
    candidate: {
      ...candidate,
      extension: {
        tags: candidate.extension?.tags ?? [],
        exportFields: materialiseExportFields(config, candidate, {
          id,
          sourceText,
          createdAt,
        }),
      },
    },
    sourceText,
    createdAt,
  };
}
