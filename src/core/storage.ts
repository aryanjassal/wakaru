import type { MiningCandidate, SavedWord, WakaruConfig } from './types.js';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveUserPath } from './config.js';
import {
  parseJsonText,
  parseWithSchema,
  savedWordSchema,
  savedWordsSchema,
} from './schemas.js';

const WORDS_FILE = 'words.json';
const ANKI_FILE = 'anki-import.tsv';

function storageDir(config: WakaruConfig): string {
  return resolveUserPath(config.storage.wordsDir);
}

async function ensureStorageDir(config: WakaruConfig): Promise<string> {
  const dir = storageDir(config);
  await mkdir(dir, { recursive: true });
  return dir;
}

function sanitizeField(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, '<br>').trim();
}

function ankiTags(word: SavedWord): string {
  return ['wakaru', word.partOfSpeech, ...word.tags]
    .filter(Boolean)
    .map((tag) => tag.replace(/\s+/g, '_'))
    .join(' ');
}

function frontHtml(word: SavedWord): string {
  const sentence = word.sourceText.trim() || word.exampleJapanese;
  return [
    `<div class="wakaru-expression">${word.expression}</div>`,
    `<div class="wakaru-sentence">${sentence}</div>`,
  ].join('');
}

function backHtml(word: SavedWord): string {
  const details = [
    word.reading,
    word.meaning,
    word.partOfSpeech,
    word.nuance ? `Nuance: ${word.nuance}` : '',
  ].filter(Boolean);

  return [
    frontHtml(word),
    '<hr>',
    ...details.map((detail) => `<div>${detail}</div>`),
    `<div>${word.exampleJapanese}</div>`,
    `<div>${word.exampleEnglish}</div>`,
  ].join('');
}

function legacyBack(word: SavedWord): string {
  return [
    `Reading: ${word.reading}`,
    `Meaning: ${word.meaning}`,
    `In context: ${word.contextMeaning}`,
    word.nuance ? `Nuance: ${word.nuance}` : '',
  ]
    .filter(Boolean)
    .join('<br>');
}

function fallbackFieldValue(word: SavedWord, fieldName: string): string {
  const normalized = fieldName.trim().toLowerCase();
  if (normalized === 'front') return frontHtml(word);
  if (normalized === 'back') return backHtml(word);
  if (normalized === 'tags') return ankiTags(word);
  if (normalized === 'expression') return word.expression;
  if (normalized === 'reading') return word.reading;
  if (normalized === 'meaning') return word.meaning;
  if (normalized === 'contextmeaning' || normalized === 'context meaning') {
    return word.contextMeaning;
  }
  if (normalized === 'partofspeech' || normalized === 'part of speech') {
    return word.partOfSpeech;
  }
  if (normalized === 'examplejapanese' || normalized === 'example japanese') {
    return word.exampleJapanese;
  }
  if (normalized === 'exampleenglish' || normalized === 'example english') {
    return word.exampleEnglish;
  }
  if (normalized === 'sourcetext' || normalized === 'source text') {
    return word.sourceText;
  }
  if (normalized === 'legacyback' || normalized === 'legacy back') {
    return legacyBack(word);
  }
  return '';
}

function fieldValue(word: SavedWord, fieldName: string): string {
  const generated = word.ankiFields[fieldName]?.trim();
  return generated || fallbackFieldValue(word, fieldName);
}

function toAnkiLine(config: WakaruConfig, word: SavedWord): string {
  return config.anki.fields
    .map((field) => fieldValue(word, field.name))
    .map(sanitizeField)
    .join('\t');
}

export async function loadSavedWords(
  config: WakaruConfig
): Promise<readonly SavedWord[]> {
  const dir = await ensureStorageDir(config);
  try {
    const raw = await readFile(join(dir, WORDS_FILE), 'utf8');
    const parsed = parseJsonText(
      raw,
      `Saved words file ${join(dir, WORDS_FILE)}`
    );
    if (!parsed.success) throw parsed.error;
    const words = parseWithSchema(
      savedWordsSchema,
      parsed.value,
      `Saved words file ${join(dir, WORDS_FILE)}`
    );
    return words;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }
}

export function candidateToSavedWord(
  candidate: MiningCandidate,
  sourceText: string
): SavedWord {
  return {
    id: candidate.id,
    expression: candidate.expression,
    reading: candidate.reading,
    meaning: candidate.meaning,
    contextMeaning: candidate.contextMeaning,
    partOfSpeech: candidate.partOfSpeech,
    nuance: candidate.nuance,
    exampleJapanese: candidate.exampleJapanese,
    exampleEnglish: candidate.exampleEnglish,
    tags: [...candidate.tags],
    ankiFields: { ...candidate.ankiFields },
    sourceText,
    createdAt: new Date().toISOString(),
  };
}

export async function saveWord(
  config: WakaruConfig,
  word: SavedWord
): Promise<void> {
  const validWord = parseWithSchema(savedWordSchema, word, 'Saved word');
  const existing = await loadSavedWords(config);
  const next = [
    validWord,
    ...existing.filter((item) => item.id !== validWord.id),
  ];
  const dir = await ensureStorageDir(config);
  await writeFile(
    join(dir, WORDS_FILE),
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8'
  );
  await writeAnkiImport(config, next);
}

export async function writeAnkiImport(
  config: WakaruConfig,
  words: readonly SavedWord[]
): Promise<string> {
  const dir = await ensureStorageDir(config);
  const path = join(dir, ANKI_FILE);
  await writeFile(
    path,
    `${words.map((word) => toAnkiLine(config, word)).join('\n')}\n`,
    'utf8'
  );
  return path;
}

export function ankiImportPath(config: WakaruConfig): string {
  return join(storageDir(config), ANKI_FILE);
}
