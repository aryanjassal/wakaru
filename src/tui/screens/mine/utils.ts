import type { MineState } from './types';
import type { MiningCandidate } from '@/tui/lib/types';

import { truncate } from '@/tui/lib/utils';

export function createInitialMineState(): MineState {
  return {
    contextText: '',
    wordText: '',
    showDetails: false,
    showContext: false,
    status: 'idle',
    candidates: [],
    addedCandidateIds: new Set(),
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

export function setCandidates(
  state: MineState,
  candidates: readonly MiningCandidate[]
): MineState {
  return {
    ...state,
    candidates,
    addedCandidateIds: new Set(),
    selectedCandidateId: candidates[0]?.id ?? null,
    showDetails: false,
    status: 'idle',
  };
}

export function markCandidate(
  state: MineState,
  candidateId: string
): MineState {
  return {
    ...state,
    addedCandidateIds: new Set([...state.addedCandidateIds, candidateId]),
  };
}

export function clearMineState(state: MineState): MineState {
  return {
    // Reset base state
    ...createInitialMineState(),
    // Retain persistent state
    wordText: state.wordText,
    contextText: state.contextText,
    showDetails: state.showDetails,
    showContext: state.showContext,
  };
}

// Return a human-readable string related to the candidate state
// TODO: kind of irrelevant. just remove
function candidateStatus(state: MineState, candidate: MiningCandidate): string {
  return state.addedCandidateIds.has(candidate.id) ? 'saved' : 'inbox';
}

export function candidateRows(state: MineState): string {
  if (!state.candidates.length) return 'No candidates yet.';
  return state.candidates
    .map((candidate, index) => {
      const marker = candidate.id === state.selectedCandidateId ? '>' : ' ';
      return [
        marker,
        String(index + 1).padStart(2, ' '),
        candidateStatus(state, candidate).padEnd(5, ' '),
        truncate(candidate.expression, 18).padEnd(18, ' '),
        truncate(candidate.reading ?? '', 18).padEnd(18, ' '),
        truncate(candidate.meanings.join('; '), 40),
      ].join(' ');
    })
    .join('\n');
}

export function candidateDetailText(state: MineState): string {
  const candidate = selectedCandidate(state);
  if (!candidate) return 'No candidate selected.';

  const base = [
    candidate.expression,
    candidate.reading ?? '',
    candidate.meanings.join('; '),
    '',
    candidate.details?.contextMeaning
      ? `In context: ${candidate.details.contextMeaning}`
      : '',
  ];
  if (!state.showDetails) {
    return [...base, '', '[d] show more info'].join('\n');
  }

  return [
    ...base,
    '',
    candidate.details?.partOfSpeech?.length
      ? `Part of speech: ${candidate.details.partOfSpeech.join(', ')}`
      : '',
    candidate.details?.nuance ? `Nuance: ${candidate.details.nuance}` : '',
    candidate.details?.example?.japanese ?? '',
    candidate.details?.example?.english ?? '',
    candidate.extension?.tags.length
      ? `Tags: ${candidate.extension.tags.join(' ')}`
      : '',
    '',
    '[d] hide details',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
