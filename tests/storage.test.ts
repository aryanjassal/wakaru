import { describe, it, expect } from '@jest/globals';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ankiImportPath,
  candidateToSavedWord,
  loadSavedWords,
  saveWord,
} from '@/core/storage.js';
import { getTestConfig, createTestCandidate } from './config.js';

describe('Storage', () => {
  it('saving a word writes JSON storage and Anki TSV', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-'));
    const config = getTestConfig({
      storage: { wordsDir: dir },
      theme: {
        name: 'night',
      },
    });
    const candidate = createTestCandidate({
      id: 'c-1',
      expression: '配慮',
      reading: 'はいりょ',
      meaning: 'consideration',
      contextMeaning: 'careful thought for someone',
      partOfSpeech: 'noun',
      nuance: 'Often used for considerate handling of people or situations.',
      exampleJapanese: '相手への配慮が必要だ。',
      exampleEnglish: 'Consideration for the other person is necessary.',
      tags: ['noun', 'mined'],
      status: 'pending',
    });

    try {
      const word = candidateToSavedWord(candidate, '相手への配慮が必要だ。');
      await saveWord(config, word);

      const saved = await loadSavedWords(config);
      const tsv = await readFile(ankiImportPath(config), 'utf8');

      expect(saved.length).toBe(1);
      expect(saved[0]?.expression).toBe('配慮');
      expect(tsv).toMatch(/wakaru-expression/);
      expect(tsv).toMatch(/配慮/);
      expect(tsv).toMatch(/はいりょ/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('Anki export uses configured field order and generated values', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-anki-'));
    const config = getTestConfig({
      storage: { wordsDir: dir },
      anki: {
        fields: [
          { name: 'CardFront', purpose: 'front html' },
          { name: 'CardBack', purpose: 'back html' },
          { name: 'Tags', purpose: 'tags' },
        ],
      },
    });
    const candidate = createTestCandidate({
      id: 'c-2',
      expression: '警察官',
      reading: 'けいさつかん',
      meaning: 'police officer',
      contextMeaning: 'police officer',
      partOfSpeech: 'noun',
      exampleJapanese: 'はい、私は警察官です。',
      exampleEnglish: 'Yes, I am a police officer.',
      tags: ['occupation'],
      ankiFields: {
        CardFront: '<div>警察官</div>',
        CardBack: '<div>けいさつかん</div>',
        Tags: 'wakaru noun occupation',
      },
      status: 'pending',
    });

    try {
      await saveWord(
        config,
        candidateToSavedWord(candidate, 'はい、私は警察官です。')
      );
      const tsv = await readFile(ankiImportPath(config), 'utf8');

      expect(tsv.trim()).toBe(
        '<div>警察官</div>\t<div>けいさつかん</div>\twakaru noun occupation'
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('loading saved words reports readable validation errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-invalid-'));
    const config = getTestConfig({
      storage: { wordsDir: dir },
      theme: {
        name: 'night',
      },
    });

    try {
      await writeFile(
        join(dir, 'words.json'),
        JSON.stringify([{ id: 'bad', expression: '', tags: ['noun'] }]),
        'utf8'
      );

      await expect(loadSavedWords(config)).rejects.toThrow(
        /Saved words file .* is invalid: 0.expression: must not be empty/
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
