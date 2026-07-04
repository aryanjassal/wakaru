import type { ExportConfig } from '../schema/config.js';

import { createHash } from 'node:crypto';

export type ExportField = ExportConfig['fields'][number];

export type ExportSchemaDiff = Readonly<{
  added: readonly ExportField[];
  removed: readonly ExportField[];
  changed: readonly Readonly<{
    key: string;
    before: ExportField;
    after: ExportField;
  }>[];
}>;

export type ExportSchemaState = Readonly<{
  stored: ExportConfig;
  configured: ExportConfig;
  storedVersion: string;
  configuredFingerprint: string;
  diff: ExportSchemaDiff;
}>;

export type ExportSchemaMigration = Readonly<{
  renames: Readonly<Record<string, string | null>>;
}>;

export function exportSchemaFingerprint(schema: ExportConfig): string {
  return createHash('sha256').update(JSON.stringify(schema)).digest('hex');
}

export function diffExportSchemas(
  stored: ExportConfig,
  configured: ExportConfig
): ExportSchemaDiff {
  const before = new Map(stored.fields.map((field) => [field.key, field]));
  const after = new Map(configured.fields.map((field) => [field.key, field]));
  const added = configured.fields.filter((field) => !before.has(field.key));
  const removed = stored.fields.filter((field) => !after.has(field.key));
  const changed = configured.fields.flatMap((field) => {
    const previous = before.get(field.key);
    return previous && JSON.stringify(previous) !== JSON.stringify(field)
      ? [{ key: field.key, before: previous, after: field }]
      : [];
  });
  return { added, removed, changed };
}
