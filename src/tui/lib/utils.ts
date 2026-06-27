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
