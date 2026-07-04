import { describe, expect, it } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WakaruDuplicateDictionarySenseError } from '@/client/errors.js';
import { tsvExportPath, writeTsvExport } from '@/client/export/tsv.js';
import { SqliteWordStore } from '@/client/storage/sqlite.js';
import { candidateToSavedWord } from '@/client/storage/words.js';
import { createTestCandidate, getTestConfig } from './config.js';
import type { ExportConfig } from '@/client/schema/config.js';

describe('SQLite word store', () => {
  it('persists words and dynamic export fields across instances', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-'));
    const path = join(dir, 'words.sqlite');
    const config = getTestConfig({
      export: {
        fields: [
          { key: 'Expression', inherit: 'expression' },
          { key: 'CardBack', modelPrompt: 'back field' },
        ],
      },
    });
    const candidate = createTestCandidate({
      extension: {
        tags: ['occupation'],
        exportFields: { CardBack: '__けいさつかん__' },
      },
    });

    try {
      const first = new SqliteWordStore(path);
      first.save(candidateToSavedWord(candidate, 'source sentence', config));
      first.close();

      const second = new SqliteWordStore(path);
      const words = second.list();
      expect(words).toHaveLength(1);
      expect(words[0]?.candidate.expression).toBe('配慮');
      expect(words[0]?.candidate.extension?.exportFields).toEqual({
        Expression: '配慮',
        CardBack: '__けいさつかん__',
      });
      second.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('blocks the same dictionary sense but allows non-dictionary copies', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-dedup-'));
    const store = new SqliteWordStore(join(dir, 'words.sqlite'));
    const dictionaryCandidate = createTestCandidate({
      details: {
        provenance: {
          definition: {
            kind: 'dictionary',
            dictionary: 'jmdict',
            entryId: '123',
            senseId: '0',
          },
        },
      },
    });
    const generatedCandidate = createTestCandidate({
      id: 'generated',
      details: { provenance: { definition: { kind: 'llm' } } },
    });
    const config = getTestConfig();

    try {
      store.save(candidateToSavedWord(dictionaryCandidate, 'first', config));
      expect(store.isSaved(dictionaryCandidate)).toBe(true);
      expect(() =>
        store.save(candidateToSavedWord(dictionaryCandidate, 'second', config))
      ).toThrow(WakaruDuplicateDictionarySenseError);
      store.save(candidateToSavedWord(generatedCandidate, 'first', config));
      store.save(candidateToSavedWord(generatedCandidate, 'second', config));
      expect(store.list()).toHaveLength(3);
    } finally {
      store.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('exports stored fields in configured order', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-tsv-'));
    const config = getTestConfig({
      export: {
        fields: [
          { key: 'CardFront', inherit: 'expression' },
          { key: 'CardBack', modelPrompt: 'back field' },
        ],
      },
    });
    const word = candidateToSavedWord(
      createTestCandidate({
        expression: '警察官',
        extension: {
          tags: [],
          exportFields: { CardBack: '__けいさつかん__' },
        },
      }),
      'はい、私は警察官です。',
      config
    );

    try {
      await writeTsvExport(config, dir, [word]);
      const tsv = await readFile(tsvExportPath(dir), 'utf8');
      expect(tsv.trim()).toBe('警察官\t__けいさつかん__');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('tracks export schema changes and migrates renamed field values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-schema-'));
    const store = new SqliteWordStore(join(dir, 'words.sqlite'));
    const original: ExportConfig = {
      fields: [{ key: 'Back', modelPrompt: 'Explain the word' }],
    };
    const configured: ExportConfig = {
      fields: [{ key: 'Definition', modelPrompt: 'Explain the word' }],
    };
    const originalConfig = getTestConfig({ export: original });
    const word = candidateToSavedWord(
      createTestCandidate({
        extension: {
          tags: [],
          exportFields: { Back: 'consideration' },
        },
      }),
      'source',
      originalConfig
    );

    try {
      expect(store.checkExportSchema(original)).toBeNull();
      store.save(word);
      const pending = store.checkExportSchema(configured);
      expect(pending?.diff.removed.map((field) => field.key)).toEqual(['Back']);
      expect(pending?.diff.added.map((field) => field.key)).toEqual([
        'Definition',
      ]);

      store.applyExportSchema(configured, {
        renames: { Back: 'Definition' },
      });

      expect(store.checkExportSchema(configured)).toBeNull();
      expect(store.list()[0]?.candidate.extension?.exportFields).toEqual({
        Definition: 'consideration',
      });
    } finally {
      store.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
