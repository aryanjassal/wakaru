import type { SavedWord } from '@/wakaru/types.js';

export function candidateMeaningText(
  candidate: SavedWord['candidate']
): string {
  return candidate.details?.contextMeaning ?? candidate.meanings.join('; ');
}

export function wordCreatedDate(word: SavedWord): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(word.createdAt));
}
