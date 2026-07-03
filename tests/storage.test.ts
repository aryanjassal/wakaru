import { describe, it, expect } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  candidateToSavedWord,
  loadSavedWords,
  saveWord,
} from '@/client/storage/files.js';
import { tsvExportPath, writeTsvExport } from '@/client/export/tsv.js';
import { getTestConfig, createTestCandidate } from './config.js';

describe('Storage', () => {
  it('saving a word writes JSON storage and a TSV export', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-'));
    const config = getTestConfig({
      export: {
        fields: [
          { key: 'expression', inherit: 'expression' },
          { key: 'reading', inherit: 'reading' },
        ],
      },
    });
    const candidate = createTestCandidate({
      id: 'c-1',
      expression: '配慮',
      reading: 'はいりょ',
      meanings: ['consideration'],
    });

    try {
      const word = candidateToSavedWord(candidate, '相手への配慮が必要だ。');
      await saveWord(dir, word);
      await writeTsvExport(config, dir, [word]);

      const loaded = await loadSavedWords(dir);
      const tsv = await readFile(tsvExportPath(dir), 'utf8');

      expect(loaded.words.length).toBe(1);
      expect(loaded.words[0]?.candidate.expression).toBe('配慮');
      expect(tsv).toMatch(/配慮/);
      expect(tsv).toMatch(/はいりょ/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('TSV export uses configured field order and generated values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-tsv-'));
    const config = getTestConfig({
      export: {
        fields: [
          { key: 'CardFront', inherit: 'expression' },
          { key: 'CardBack', modelPrompt: 'back field' },
          { key: 'Tags', modelPrompt: 'tags' },
        ],
      },
    });
    const candidate = createTestCandidate({
      id: 'c-2',
      expression: '警察官',
      reading: 'けいさつかん',
      meanings: ['police officer'],
      details: {
        contextMeaning: 'police officer',
        partOfSpeech: ['noun'],
        example: {
          japanese: 'はい、私は警察官です。',
          english: 'Yes, I am a police officer.',
        },
      },
      extension: {
        tags: ['occupation'],
        exportFields: {
          CardBack: '__けいさつかん__',
          Tags: 'noun occupation',
        },
      },
    });

    try {
      const word = candidateToSavedWord(candidate, 'はい、私は警察官です。');
      await saveWord(dir, word);
      await writeTsvExport(config, dir, [word]);
      const tsv = await readFile(tsvExportPath(dir), 'utf8');

      expect(tsv.trim()).toBe('警察官\t__けいさつかん__\tnoun occupation');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('loading saved words omits invalid entries without deleting them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-invalid-'));
    try {
      await writeFile(
        join(dir, 'words.json'),
        JSON.stringify([{ id: 'bad', expression: '', tags: ['noun'] }]),
        'utf8'
      );

      const loaded = await loadSavedWords(dir);
      expect(loaded.words).toEqual([]);
      expect(loaded.failedCount).toBe(1);
      expect(loaded.rejectedEntries).toHaveLength(1);
      expect(
        JSON.parse(await readFile(join(dir, 'words.json'), 'utf8'))
      ).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
