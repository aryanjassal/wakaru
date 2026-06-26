import { describe, it, expect } from '@jest/globals';
import {
  createInitialWakaruState,
  reduceWakaruState,
} from '../src/tui/state.js';
import { getTestConfig, createTestCandidate } from './config.js';

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

  const candidate = createTestCandidate({
    id: 'c-1',
    expression: '曖昧',
    reading: 'あいまい',
    meaning: 'ambiguous',
    contextMeaning: 'unclear in the pasted sentence',
    partOfSpeech: 'na-adjective',
    exampleJapanese: '曖昧な返事をした。',
    exampleEnglish: 'They gave an ambiguous answer.',
    tags: ['jp', 'adjective'],
    status: 'pending',
  });

  it('initial state uses config theme and empty mining queues', () => {
    const state = createInitialWakaruState(config, 1_000, {
      cols: 100,
      rows: 32,
    });

    expect(state.status).toBe('idle');
    expect(state.candidates.length).toBe(0);
    expect(state.savedWords.length).toBe(0);
    expect(state.viewportCols).toBe(100);
  });

  it('candidate selection and marking are immutable', () => {
    const initial = createInitialWakaruState(config);
    const withCandidates = reduceWakaruState(initial, {
      type: 'set-candidates',
      candidates: [candidate],
    });
    const marked = reduceWakaruState(withCandidates, {
      type: 'mark-candidate',
      candidateId: candidate.id,
      status: 'added',
    });

    expect(withCandidates.selectedCandidateId).toBe(candidate.id);
    expect(withCandidates.candidates[0]?.status).toBe('pending');
    expect(marked.candidates[0]?.status).toBe('added');
  });

  it('toasts can be pruned by duration', () => {
    const initial = createInitialWakaruState(config, 0);
    const withToast = reduceWakaruState(initial, {
      type: 'add-toast',
      toast: {
        id: 'toast-1',
        message: 'Saved',
        level: 'success',
        timestamp: 0,
        durationMs: 100,
      },
    });
    const pruned = reduceWakaruState(withToast, {
      type: 'prune-toasts',
      nowMs: 200,
    });

    expect(withToast.toasts.length).toBe(1);
    expect(pruned.toasts.length).toBe(0);
  });
});
