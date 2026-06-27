import type { SavedWord, TuiToast } from './types.js';

export function truncate(value: string, length: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}...`;
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

export function toastText(toasts: readonly TuiToast[]): string {
  return toasts
    .slice(-3)
    .map((toast) => `${toast.level}: ${toast.message}`)
    .join('\n');
}
