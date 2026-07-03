import type { ClientCandidate, SavedWord } from '../types.js';

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { savedWordSchema, savedWordsSchema } from '../schema/vocabulary.js';
import { parseJsonText, parseWithSchema } from '@/core/validation/json.js';
import { ensureDirectory } from '../utils';

const WORDS_FILE = 'words.json';

export async function loadSavedWords(
  wordsDir: string
): Promise<SavedWordsLoadResult> {
  const dir = await ensureDirectory(wordsDir);
  try {
    const raw = await readFile(join(dir, WORDS_FILE), 'utf8');
    const parsed = parseJsonText(
      raw,
      `Saved words file ${join(dir, WORDS_FILE)}`
    );
    if (!parsed.success) throw parsed.error;
    if (!Array.isArray(parsed.value)) {
      parseWithSchema(
        savedWordsSchema,
        parsed.value,
        `Saved words file ${join(dir, WORDS_FILE)}`
      );
    }
    const words: SavedWord[] = [];
    const rejectedEntries: unknown[] = [];
    for (const entry of parsed.value as unknown[]) {
      const result = savedWordSchema.safeParse(entry);
      if (result.success) words.push(result.data);
      else rejectedEntries.push(entry);
    }
    return {
      words,
      failedCount: rejectedEntries.length,
      rejectedEntries,
    };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return { words: [], failedCount: 0, rejectedEntries: [] };
    }
    throw error;
  }
}

export type SavedWordsLoadResult = Readonly<{
  words: readonly SavedWord[];
  failedCount: number;
  rejectedEntries: readonly unknown[];
}>;

export function candidateToSavedWord(
  candidate: ClientCandidate,
  sourceText: string
): SavedWord {
  return {
    candidate,
    sourceText,
    createdAt: new Date().toISOString(),
  };
}

export async function saveWord(
  wordsDir: string,
  word: SavedWord
): Promise<void> {
  const validWord = parseWithSchema(savedWordSchema, word, 'Saved word');
  const loaded = await loadSavedWords(wordsDir);
  const next = [
    validWord,
    ...loaded.words.filter(
      (item) => item.candidate.id !== validWord.candidate.id
    ),
    ...loaded.rejectedEntries,
  ];
  const dir = await ensureDirectory(wordsDir);
  await writeFile(
    join(dir, WORDS_FILE),
    `${JSON.stringify(next, null, 2)}\n`,
    'utf8'
  );
}
