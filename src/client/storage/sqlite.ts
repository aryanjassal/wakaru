import type { ClientCandidate, SavedWord } from '../types.js';
import type { WordStore } from './words.js';
import type { ExportConfig } from '../schema/config.js';
import type {
  ExportSchemaMigration,
  ExportSchemaState,
} from './schema-diff.js';

import Database from 'better-sqlite3';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseWithSchema } from '@/core/validation/json.js';
import { WakaruDuplicateDictionarySenseError } from '../errors.js';
import { WakaruExportSchemaError } from '../errors.js';
import { savedWordSchema } from '../schema/vocabulary.js';
import { exportConfigSchema } from '../schema/config.js';
import {
  exportSchemaVersions,
  savedWordFields,
  savedWords,
  wordStoreMetadata,
} from './schema.js';
import { diffExportSchemas, exportSchemaFingerprint } from './schema-diff.js';
import { dictionarySource } from './words.js';

export class SqliteWordStore implements WordStore {
  private readonly sqlite: Database.Database;
  private readonly database;

  public constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path);
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('journal_mode = WAL');
    this.createSchema();
    this.database = drizzle(this.sqlite);
  }

  public list(): readonly SavedWord[] {
    const words = this.database
      .select()
      .from(savedWords)
      .orderBy(desc(savedWords.createdAt))
      .all();
    const fields = this.database.select().from(savedWordFields).all();
    const fieldsByWord = new Map<string, Record<string, string>>();
    for (const field of fields) {
      const values = fieldsByWord.get(field.wordId) ?? {};
      values[field.fieldId] = field.value;
      fieldsByWord.set(field.wordId, values);
    }
    return words.map((word) =>
      parseWithSchema(
        savedWordSchema,
        {
          id: word.id,
          candidate: {
            ...word.candidate,
            extension: {
              tags: word.candidate.extension?.tags ?? [],
              exportFields: fieldsByWord.get(word.id) ?? {},
            },
          },
          sourceText: word.sourceText,
          createdAt: word.createdAt,
        },
        `Saved word ${word.id}`
      )
    );
  }

  public save(word: SavedWord): void {
    const validWord = parseWithSchema(savedWordSchema, word, 'Saved word');
    const source = dictionarySource(validWord.candidate);
    if (source) {
      const existing = this.findDictionarySense(
        source.dictionary,
        source.entryId,
        source.senseId
      );
      if (existing) {
        throw new WakaruDuplicateDictionarySenseError(existing.id);
      }
    }

    const extension = validWord.candidate.extension;
    const storedCandidate: ClientCandidate = {
      ...validWord.candidate,
      extension: {
        tags: extension?.tags ?? [],
        exportFields: {},
      },
    };
    this.sqlite.transaction(() => {
      this.database
        .insert(savedWords)
        .values({
          id: validWord.id,
          candidate: storedCandidate,
          sourceText: validWord.sourceText,
          createdAt: validWord.createdAt,
          sourceDictionary: source?.dictionary,
          sourceEntryId: source?.entryId,
          sourceSenseId: source?.senseId,
        })
        .run();
      const now = new Date().toISOString();
      const fields = Object.entries(extension?.exportFields ?? {}).map(
        ([fieldId, value]) => ({
          wordId: validWord.id,
          fieldId,
          value,
          source: 'model' as const,
          updatedAt: now,
        })
      );
      if (fields.length) {
        this.database.insert(savedWordFields).values(fields).run();
      }
    })();
  }

  public isSaved(candidate: ClientCandidate): boolean {
    const source = dictionarySource(candidate);
    if (!source) return false;
    return Boolean(
      this.findDictionarySense(
        source.dictionary,
        source.entryId,
        source.senseId
      )
    );
  }

  public checkExportSchema(configured: ExportConfig): ExportSchemaState | null {
    const fingerprint = exportSchemaFingerprint(configured);
    const active = this.database
      .select({ version: wordStoreMetadata.value })
      .from(wordStoreMetadata)
      .where(eq(wordStoreMetadata.key, 'active_export_schema'))
      .get();
    if (!active) {
      this.activateExportSchema(configured, fingerprint);
      return null;
    }
    const storedRow = this.database
      .select()
      .from(exportSchemaVersions)
      .where(eq(exportSchemaVersions.version, active.version))
      .get();
    if (!storedRow) {
      throw new WakaruExportSchemaError(
        `Export schema version ${active.version} is missing.`
      );
    }
    if (storedRow.fingerprint === fingerprint) return null;
    const stored = parseWithSchema(
      exportConfigSchema,
      storedRow.definition,
      `Export schema ${active.version}`
    );
    return {
      stored,
      configured,
      storedVersion: active.version,
      configuredFingerprint: fingerprint,
      diff: diffExportSchemas(stored, configured),
    };
  }

  public applyExportSchema(
    configured: ExportConfig,
    migration: ExportSchemaMigration
  ): void {
    const fingerprint = exportSchemaFingerprint(configured);
    this.sqlite.transaction(() => {
      for (const [from, to] of Object.entries(migration.renames)) {
        if (!to || from === to) continue;
        this.database
          .update(savedWordFields)
          .set({ fieldId: to })
          .where(eq(savedWordFields.fieldId, from))
          .run();
      }
      this.activateExportSchema(configured, fingerprint);
    })();
  }

  public close(): void {
    this.sqlite.close();
  }

  private findDictionarySense(
    dictionary: string,
    entryId: string,
    senseId: string
  ): { id: string } | undefined {
    return this.database
      .select({ id: savedWords.id })
      .from(savedWords)
      .where(
        and(
          eq(savedWords.sourceDictionary, dictionary),
          eq(savedWords.sourceEntryId, entryId),
          eq(savedWords.sourceSenseId, senseId)
        )
      )
      .get();
  }

  private activateExportSchema(
    definition: ExportConfig,
    fingerprint: string
  ): void {
    const version = crypto.randomUUID();
    this.database
      .insert(exportSchemaVersions)
      .values({
        version,
        fingerprint,
        definition,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing({ target: exportSchemaVersions.fingerprint })
      .run();
    const stored = this.database
      .select({ version: exportSchemaVersions.version })
      .from(exportSchemaVersions)
      .where(eq(exportSchemaVersions.fingerprint, fingerprint))
      .get();
    if (!stored) {
      throw new WakaruExportSchemaError(
        'Failed to activate the export schema.'
      );
    }
    this.database
      .insert(wordStoreMetadata)
      .values({ key: 'active_export_schema', value: stored.version })
      .onConflictDoUpdate({
        target: wordStoreMetadata.key,
        set: { value: stored.version },
      })
      .run();
  }

  private createSchema(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS saved_word (
        id TEXT PRIMARY KEY NOT NULL,
        candidate TEXT NOT NULL,
        source_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        source_dictionary TEXT,
        source_entry_id TEXT,
        source_sense_id TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS saved_word_dictionary_sense_idx
        ON saved_word (source_dictionary, source_entry_id, source_sense_id)
        WHERE source_dictionary IS NOT NULL;
      CREATE INDEX IF NOT EXISTS saved_word_created_at_idx
        ON saved_word (created_at);
      CREATE TABLE IF NOT EXISTS saved_word_field (
        word_id TEXT NOT NULL REFERENCES saved_word(id) ON DELETE CASCADE,
        field_id TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL,
        prompt_hash TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (word_id, field_id)
      );
      CREATE TABLE IF NOT EXISTS export_schema_version (
        version TEXT PRIMARY KEY NOT NULL,
        fingerprint TEXT NOT NULL UNIQUE,
        definition TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS word_store_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  }
}
