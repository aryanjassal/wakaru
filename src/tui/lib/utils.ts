import type { SavedWord, TuiToast } from './types.js';

import { execFileSync } from 'node:child_process';

const CLIPBOARD_COMMANDS: readonly Readonly<{
  command: string;
  args: readonly string[];
}>[] = [
  { command: 'wl-paste', args: ['--no-newline'] },
  { command: 'xclip', args: ['-selection', 'clipboard', '-out'] },
  { command: 'xsel', args: ['--clipboard', '--output'] },
  { command: 'pbpaste', args: [] },
  {
    command: 'powershell.exe',
    args: ['-NoProfile', '-Command', 'Get-Clipboard'],
  },
];

export function readClipboard(): string | null {
  for (const { command, args } of CLIPBOARD_COMMANDS) {
    try {
      return execFileSync(command, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1_000,
      }).trim();
    } catch {
      // Try the next platform-specific clipboard command.
    }
  }
  return null;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function truncate(value: string, length: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, Math.max(0, length - 1))}...`;
}

export function savedWordRows(words: readonly SavedWord[]): string {
  if (!words.length) return 'No saved words yet.';
  return words
    .slice(0, 30)
    .map(({ candidate }, index) =>
      [
        String(index + 1).padStart(2, ' '),
        truncate(candidate.expression, 18).padEnd(18, ' '),
        truncate(candidate.reading ?? '', 18).padEnd(18, ' '),
        truncate(
          candidate.details?.contextMeaning ?? candidate.meanings.join('; '),
          48
        ),
      ].join(' ')
    )
    .join('\n');
}

export function toastText(
  toasts: readonly TuiToast[],
  count: number = 1
): string {
  return toasts
    .slice(-count)
    .map((toast) => `${toast.level}: ${toast.message}`)
    .join('\n');
}

// Mining candidate tags include their sources, like `jmdict` or `jmnedic`. The
// sources are relevant as `jmnedic` matches are names, and `jmdict` matches are
// actual definitions. These words might not mean anything to the user so these
// specific words are replaced, otherwise the word passes through.
export function humaniseTag(tag: string): string {
  switch (tag) {
    case 'jmdict':
      return 'definition';
    case 'jmnedict':
      return 'name';
    default:
      return tag;
  }
}
