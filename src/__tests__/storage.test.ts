import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { MiningCandidate, WakaruConfig } from '../types.js';
import {
  ankiImportPath,
  candidateToSavedWord,
  loadSavedWords,
  saveWord,
} from '../wakaru/storage.js';
import {
  miningCandidateSchema,
  parseWithSchema,
  wakaruConfigSchema,
} from '../wakaru/schemas.js';

test('saving a word writes JSON storage and Anki TSV', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-'));
  const config: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
    llm: {
      provider: 'ollama',
      model: 'test-model',
      apiBase: 'http://localhost:11434',
    },
    storage: { wordsDir: dir },
    theme: {
      name: 'night',
      customPath: join(dir, 'theme.json'),
    },
  });
  const candidate: MiningCandidate = parseWithSchema(miningCandidateSchema, {
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

    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.expression, '配慮');
    assert.match(tsv, /wakaru-expression/);
    assert.match(tsv, /配慮/);
    assert.match(tsv, /はいりょ/);
    assert.match(tsv, /wakaru noun noun mined/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Anki export uses configured field order and generated values', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-anki-'));
  const config: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
    llm: {
      provider: 'ollama',
      model: 'test-model',
      apiBase: 'http://localhost:11434',
    },
    storage: { wordsDir: dir },
    anki: {
      fields: [
        { name: 'CardFront', purpose: 'front html' },
        { name: 'CardBack', purpose: 'back html' },
        { name: 'Tags', purpose: 'tags' },
      ],
    },
  });
  const candidate: MiningCandidate = parseWithSchema(miningCandidateSchema, {
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

    assert.equal(
      tsv.trim(),
      '<div>警察官</div>\t<div>けいさつかん</div>\twakaru noun occupation'
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('loading saved words reports readable validation errors', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wakaru-storage-invalid-'));
  const config: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
    llm: {
      provider: 'ollama',
      model: 'test-model',
      apiBase: 'http://localhost:11434',
    },
    storage: { wordsDir: dir },
    theme: {
      name: 'night',
      customPath: join(dir, 'theme.json'),
    },
  });

  try {
    await writeFile(
      join(dir, 'words.json'),
      JSON.stringify([{ id: 'bad', expression: '', tags: ['noun'] }]),
      'utf8'
    );

    await assert.rejects(
      loadSavedWords(config),
      /Saved words file .* is invalid: 0.expression: must not be empty/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
