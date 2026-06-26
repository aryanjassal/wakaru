import type { MiningCandidate, SavedWord, WakaruState } from './types.js';

export function truncate(value: string, length: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}...`;
}

export function selectedCandidate(state: WakaruState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
}

function candidateStatus(candidate: MiningCandidate): string {
  if (candidate.status === 'added') return 'saved';
  if (candidate.status === 'skipped') return 'off';
  return 'inbox';
}

export function candidateRows(state: WakaruState): string {
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

export function candidateDetailText(state: WakaruState): string {
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

export function savedWordRows(words: readonly SavedWord[]): string {
  if (!words.length) return 'No saved words yet.';
  return words
    .slice(0, 30)
    .map((word, index) =>
      [
        String(index + 1).padStart(2, ' '),
        truncate(word.expression, 18).padEnd(18, ' '),
        truncate(word.reading, 18).padEnd(18, ' '),
        truncate(word.contextMeaning, 48),
      ].join(' ')
    )
    .join('\n');
}

export function toastText(state: WakaruState): string {
  return state.toasts
    .slice(-3)
    .map((toast) => `${toast.level}: ${toast.message}`)
    .join('\n');
}
