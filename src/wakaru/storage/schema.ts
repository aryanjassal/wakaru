import type { ClientCandidate } from '../types.js';
import type { ExportConfig } from '../schema/config.js';

import { sql } from 'drizzle-orm';
import {
  index,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const savedWords = sqliteTable(
  'saved_word',
  {
    id: text('id').primaryKey(),
    candidate: text('candidate', { mode: 'json' })
      .$type<ClientCandidate>()
      .notNull(),
    sourceText: text('source_text').notNull(),
    createdAt: text('created_at').notNull(),
    sourceDictionary: text('source_dictionary'),
    sourceEntryId: text('source_entry_id'),
    sourceSenseId: text('source_sense_id'),
  },
  (table) => [
    uniqueIndex('saved_word_dictionary_sense_idx')
      .on(table.sourceDictionary, table.sourceEntryId, table.sourceSenseId)
      .where(sql`${table.sourceDictionary} is not null`),
    index('saved_word_created_at_idx').on(table.createdAt),
  ]
);

export const savedWordFields = sqliteTable(
  'saved_word_field',
  {
    wordId: text('word_id')
      .notNull()
      .references(() => savedWords.id, { onDelete: 'cascade' }),
    fieldId: text('field_id').notNull(),
    value: text('value').notNull(),
    source: text('source', { enum: ['model', 'manual'] }).notNull(),
    promptHash: text('prompt_hash'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.wordId, table.fieldId] })]
);

export const exportSchemaVersions = sqliteTable('export_schema_version', {
  version: text('version').primaryKey(),
  fingerprint: text('fingerprint').notNull().unique(),
  definition: text('definition', { mode: 'json' })
    .$type<ExportConfig>()
    .notNull(),
  createdAt: text('created_at').notNull(),
});

export const wordStoreMetadata = sqliteTable('word_store_metadata', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
