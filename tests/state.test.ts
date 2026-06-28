import { describe, it, expect } from '@jest/globals';
import type { SavedWord } from '../src/tui/lib/types.js';
import {
  addSavedWord,
  addToast,
  createInitialTuiState,
  pruneToasts,
} from '../src/tui/lib/state.js';
import { getTestConfig } from './config.js';

describe('State', () => {
  const config = getTestConfig({
    llm: {
      provider: 'ollama',
      model: 'test-model',
      apiBase: 'http://localhost:11434',
    },
    storage: {
      wordsDir: '/tmp/wakaru-test',
    },
    theme: {
      name: 'night',
    },
  });

  const word: SavedWord = {
    id: 'c-1',
    expression: '曖昧',
    reading: 'あいまい',
    meaning: 'ambiguous',
    contextMeaning: 'unclear in the pasted sentence',
    partOfSpeech: 'na-adjective',
    exampleJapanese: '曖昧な返事をした。',
    exampleEnglish: 'They gave an ambiguous answer.',
    tags: ['jp', 'adjective'],
    ankiFields: {
      Front: '曖昧',
      Back: 'ambiguous',
    },
    sourceText: '曖昧な返事',
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('initial state uses config and saved words', () => {
    const state = createInitialTuiState(
      config,
      1_000,
      {
        cols: 100,
        rows: 32,
      },
      [word]
    );

    expect(state.config.theme.name).toBe('night');
    expect(state.savedWords.length).toBe(1);
    expect(state.viewportCols).toBe(100);
  });

  it('saved word updates are immutable', () => {
    const initial = createInitialTuiState(config);
    const updated = addSavedWord(initial, word);

    expect(initial.savedWords.length).toBe(0);
    expect(updated.savedWords[0]).toBe(word);
  });

  it('toasts can be pruned by duration', () => {
    const initial = createInitialTuiState(config, 0);
    const withToast = addToast(initial, {
      id: 'toast-1',
      message: 'Saved',
      level: 'success',
      timestamp: 0,
      durationMs: 100,
    });
    const pruned = pruneToasts(withToast, 200);

    expect(withToast.toasts.length).toBe(1);
    expect(pruned.toasts.length).toBe(0);
  });
});
