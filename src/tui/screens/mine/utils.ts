import type { MineState } from './types.js';
import type {
  MiningCandidate,
  MiningCandidateStatus,
  TuiMiningStatus,
} from '../../types.js';

import { truncate } from '../../format.js';

export function createInitialMineState(): MineState {
  return {
    contextText: '',
    wordText: '',
    showDetails: false,
    status: 'idle',
    statusMessage: 'Paste a word, optionally add context, then analyze.',
    errorMessage: null,
    candidates: [],
    selectedCandidateId: null,
  };
}

export function selectedIndex(
  candidates: readonly MiningCandidate[],
  id: string | null
): number {
  return candidates.findIndex((candidate) => candidate.id === id);
}

export function selectedCandidate(state: MineState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
}

export function setStatus(
  state: MineState,
  status: TuiMiningStatus,
  message = state.statusMessage
): MineState {
  return {
    ...state,
    status,
    statusMessage: message,
    errorMessage: status === 'error' ? state.errorMessage : null,
  };
}

export function setError(state: MineState, message: string): MineState {
  return {
    ...state,
    status: 'error',
    statusMessage: 'Action failed.',
    errorMessage: message,
  };
}

export function setCandidates(
  state: MineState,
  candidates: readonly MiningCandidate[]
): MineState {
  return {
    ...state,
    candidates,
    selectedCandidateId: candidates[0]?.id ?? null,
    showDetails: false,
    status: 'idle',
    statusMessage: candidates.length
      ? 'Review the word meaning, then add or skip it.'
      : 'No meaning found. Try adding a context sentence.',
    errorMessage: null,
  };
}

export function markCandidate(
  state: MineState,
  candidateId: string,
  status: MiningCandidateStatus
): MineState {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, status } : candidate
    ),
  };
}

export function toggleCandidateInbox(
  state: MineState,
  candidateId: string
): MineState {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.id === candidateId
        ? {
            ...candidate,
            status: candidate.status === 'skipped' ? 'pending' : 'skipped',
          }
        : candidate
    ),
  };
}

export function clearMineState(state: MineState): MineState {
  return {
    ...state,
    ...createInitialMineState(),
  };
}

function candidateStatus(candidate: MiningCandidate): string {
  if (candidate.status === 'added') return 'saved';
  if (candidate.status === 'skipped') return 'off';
  return 'inbox';
}

export function candidateRows(state: MineState): string {
  if (!state.candidates.length) return 'No candidates yet.';
  return state.candidates
    .map((candidate, index) => {
      const marker = candidate.id === state.selectedCandidateId ? '>' : ' ';
      return [
        marker,
        String(index + 1).padStart(2, ' '),
        candidateStatus(candidate).padEnd(5, ' '),
        truncate(candidate.expression, 18).padEnd(18, ' '),
        truncate(candidate.reading, 18).padEnd(18, ' '),
        truncate(candidate.meaning, 40),
      ].join(' ');
    })
    .join('\n');
}

export function candidateDetailText(state: MineState): string {
  const candidate = selectedCandidate(state);
  if (!candidate) return 'No candidate selected.';

  const base = [
    candidate.expression,
    candidate.reading,
    candidate.meaning,
    '',
    `In context: ${candidate.contextMeaning}`,
  ];
  if (!state.showDetails) {
    return [...base, '', '[d] show more info'].join('\n');
  }

  return [
    ...base,
    '',
    `Part of speech: ${candidate.partOfSpeech}`,
    candidate.nuance ? `Nuance: ${candidate.nuance}` : '',
    candidate.exampleJapanese,
    candidate.exampleEnglish,
    candidate.tags.length ? `Tags: ${candidate.tags.join(' ')}` : '',
    '',
    '[d] hide details',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
