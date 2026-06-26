import type { MiningCandidate, TuiCommandContext } from './types.js';

import { execFileSync } from 'node:child_process';
import { analyzeWithOllama } from '@/core/llm.js';
import {
  candidateToSavedWord,
  saveWord,
  writeAnkiImport,
} from '@/core/storage.js';
import {
  addSavedWord,
  addToast,
  clearMine as clearMineState,
  createToast,
  markCandidate,
  pruneToasts,
  selectCandidate,
  selectedCandidate,
  setCandidates,
  setError,
  setStatus,
  setViewport,
  toggleCandidateInbox,
} from './state.js';

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

function readClipboard(): string | null {
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function selectedIndex(
  candidates: readonly MiningCandidate[],
  id: string | null
): number {
  return candidates.findIndex((candidate) => candidate.id === id);
}

export async function quit(ctx: TuiCommandContext): Promise<void> {
  await ctx.stop();
}

export function tick(ctx: TuiCommandContext): void {
  ctx.setState((state) => ({ ...state, nowMs: Date.now() }));
}

export function pruneExpiredToasts(ctx: TuiCommandContext): void {
  ctx.setState((state) => pruneToasts(state, Date.now()));
}

export function resizeViewport(
  ctx: TuiCommandContext,
  cols: number,
  rows: number
): void {
  ctx.setState((state) => setViewport(state, cols, rows));
}

export function syncMineInputs(
  ctx: TuiCommandContext,
  input: Readonly<{ wordText: string; contextText: string }>
): void {
  ctx.setState((state) => ({
    ...state,
    wordText: input.wordText,
    contextText: input.contextText,
  }));
}

export function toggleCommandPalette(ctx: TuiCommandContext): void {
  ctx.setState((state) => ({
    ...state,
    showCommandPalette: !state.showCommandPalette,
    commandQuery: '',
    commandIndex: 0,
  }));
}

export async function analyzeWord(ctx: TuiCommandContext): Promise<void> {
  ctx.syncInputs();
  const state = ctx.getState();
  const word = state.wordText.trim();
  const contextText = state.contextText.trim();
  if (!word || state.status === 'analyzing' || state.status === 'saving') {
    return;
  }

  ctx.setState((current) =>
    setStatus(current, 'analyzing', 'Analyzing word with Ollama...')
  );

  try {
    const candidates = await analyzeWithOllama(state.config, word, {
      contextText,
    });
    ctx.setState((current) =>
      addToast(
        setCandidates(current, candidates),
        createToast(
          `Found ${candidates.length} meaning${candidates.length === 1 ? '' : 's'}.`,
          'success'
        )
      )
    );
  } catch (error) {
    const message = errorMessage(error);
    ctx.setState((current) =>
      addToast(setError(current, message), createToast(message, 'error'))
    );
  }
}

export async function addSelectedCandidate(
  ctx: TuiCommandContext
): Promise<void> {
  const state = ctx.getState();
  const candidate = selectedCandidate(state);
  if (
    !candidate ||
    candidate.status === 'added' ||
    candidate.status === 'skipped' ||
    state.status === 'saving'
  ) {
    return;
  }

  ctx.setState((current) =>
    setStatus(current, 'saving', `Saving ${candidate.expression}...`)
  );

  try {
    const sourceText = state.contextText.trim() || state.wordText.trim();
    const word = candidateToSavedWord(candidate, sourceText);
    await saveWord(state.config, word);
    ctx.setState((current) =>
      addToast(
        setStatus(
          markCandidate(addSavedWord(current, word), candidate.id, 'added'),
          'idle',
          `${candidate.expression} saved to Anki import file.`
        ),
        createToast(`Saved ${candidate.expression}.`, 'success')
      )
    );
  } catch (error) {
    const message = errorMessage(error);
    ctx.setState((current) =>
      addToast(setError(current, message), createToast(message, 'error'))
    );
  }
}

export function skipSelectedCandidate(ctx: TuiCommandContext): void {
  const candidate = selectedCandidate(ctx.getState());
  if (!candidate || candidate.status === 'added') return;

  ctx.setState((current) =>
    addToast(
      toggleCandidateInbox(current, candidate.id),
      createToast(
        candidate.status === 'skipped'
          ? `${candidate.expression} back in inbox.`
          : `${candidate.expression} removed from inbox.`,
        candidate.status === 'skipped' ? 'info' : 'warning'
      )
    )
  );
}

export function clearMine(ctx: TuiCommandContext): void {
  ctx.setState(clearMineState);
}

export function pasteClipboard(ctx: TuiCommandContext): void {
  const text = readClipboard();
  if (!text) {
    ctx.setState((state) =>
      addToast(state, createToast('Clipboard is unavailable.', 'warning'))
    );
    return;
  }

  ctx.setState((state) => ({
    ...state,
    wordText: text,
  }));
}

export async function exportAnki(ctx: TuiCommandContext): Promise<void> {
  const state = ctx.getState();
  try {
    const path = await writeAnkiImport(state.config, state.savedWords);
    ctx.setState((current) =>
      addToast(current, createToast(`Wrote ${path}.`, 'success'))
    );
  } catch (error) {
    const message = errorMessage(error);
    ctx.setState((current) =>
      addToast(setError(current, message), createToast(message, 'error'))
    );
  }
}

export function navigateMine(ctx: TuiCommandContext): void {
  ctx.navigate('mine');
}

export function navigateLibrary(ctx: TuiCommandContext): void {
  ctx.navigate('library');
}

export function navigateSettings(ctx: TuiCommandContext): void {
  ctx.navigate('settings');
}

export function navigateNext(ctx: TuiCommandContext): void {
  ctx.navigateOffset(1);
}

export function navigatePrevious(ctx: TuiCommandContext): void {
  ctx.navigateOffset(-1);
}

export function selectPreviousCandidate(ctx: TuiCommandContext): void {
  selectCandidateOffset(ctx, -1);
}

export function selectNextCandidate(ctx: TuiCommandContext): void {
  selectCandidateOffset(ctx, 1);
}

export function selectCandidateOffset(
  ctx: TuiCommandContext,
  offset: 1 | -1
): void {
  const state = ctx.getState();
  if (!state.candidates.length) return;
  const index = selectedIndex(state.candidates, state.selectedCandidateId);
  const safeIndex = index < 0 ? 0 : index;
  const next =
    state.candidates[
      (safeIndex + offset + state.candidates.length) % state.candidates.length
    ];
  ctx.setState((current) => selectCandidate(current, next?.id ?? null));
}

export function toggleDetails(ctx: TuiCommandContext): void {
  ctx.setState((state) => ({
    ...state,
    showDetails: !state.showDetails,
  }));
}
