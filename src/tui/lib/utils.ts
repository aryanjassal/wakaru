import type { SavedWord, TuiToast } from '../types.js';

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
