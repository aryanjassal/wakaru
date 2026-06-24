import assert from 'node:assert/strict';
import test from 'node:test';
import type { MiningCandidate, WakaruConfig } from '../types.js';
import {
  createInitialWakaruState,
  reduceWakaruState,
} from '../wakaru/state.js';
import {
  miningCandidateSchema,
  parseWithSchema,
  wakaruConfigSchema,
} from '../wakaru/schemas.js';

const config: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
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
    customPath: '/tmp/wakaru-theme.json',
  },
});

const candidate: MiningCandidate = parseWithSchema(miningCandidateSchema, {
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

test('initial state uses config theme and empty mining queues', () => {
  const state = createInitialWakaruState(config, 1_000, {
    cols: 100,
    rows: 32,
  });

  assert.equal(state.themeName, 'night');
  assert.equal(state.status, 'idle');
  assert.equal(state.candidates.length, 0);
  assert.equal(state.savedWords.length, 0);
  assert.equal(state.viewportCols, 100);
});

test('candidate selection and marking are immutable', () => {
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

  assert.equal(withCandidates.selectedCandidateId, candidate.id);
  assert.equal(withCandidates.candidates[0]?.status, 'pending');
  assert.equal(marked.candidates[0]?.status, 'added');
});

test('toasts can be pruned by duration', () => {
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

  assert.equal(withToast.toasts.length, 1);
  assert.equal(pruned.toasts.length, 0);
});
