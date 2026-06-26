import type { WakaruConfig } from '@/core/types.js';
import type {
  MiningCandidate,
  WakaruAction,
  WakaruRouteId,
  WakaruState,
} from './types.js';

import { execFileSync } from 'node:child_process';
import { analyzeWithOllama } from '@/core/llm.js';
import {
  candidateToSavedWord,
  saveWord,
  writeAnkiImport,
} from '@/core/storage.js';

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

export type WakaruActions = Readonly<{
  analyzeInput: () => Promise<void>;
  analyzeCustomWord: () => Promise<void>;
  addSelected: () => Promise<void>;
  skipSelected: () => void;
  clearMine: () => void;
  pasteClipboard: () => void;
  exportAnki: () => Promise<void>;
  navigate: (routeId: WakaruRouteId) => void;
  stop: () => Promise<void>;
}>;

type ActionDeps = Readonly<{
  config: WakaruConfig;
  getState: () => WakaruState;
  dispatch: (action: WakaruAction) => void;
  navigate: (routeId: WakaruRouteId) => void;
  stop: () => Promise<void>;
}>;

function toast(
  message: string,
  level: 'info' | 'success' | 'warning' | 'error' = 'info'
): WakaruAction {
  return {
    type: 'add-toast',
    toast: {
      id: `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      message,
      level,
      timestamp: Date.now(),
      durationMs: 3200,
    },
  };
}

function selectedCandidate(state: WakaruState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
}

function effectiveInputMode(state: WakaruState): 'word' | 'sentence' {
  if (state.inputMode === 'word' || state.inputMode === 'sentence') {
    return state.inputMode;
  }
  return state.inputText.trim().length >
    state.config.analysis.sentenceModeThreshold
    ? 'sentence'
    : 'word';
}

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

export function createWakaruActions(deps: ActionDeps): WakaruActions {
  const { config, dispatch, getState } = deps;

  return {
    async analyzeInput(): Promise<void> {
      const state = getState();
      const text = state.inputText.trim();
      if (!text || state.status === 'analyzing' || state.status === 'saving') {
        return;
      }

      const mode = effectiveInputMode(state);
      dispatch({
        type: 'set-status',
        status: 'analyzing',
        message:
          mode === 'sentence'
            ? 'Tokenizing sentence with Ollama...'
            : 'Analyzing word input with Ollama...',
      });

      try {
        const candidates = await analyzeWithOllama(config, text, {
          mode,
          contextText: state.contextText,
        });
        dispatch({ type: 'set-candidates', candidates });
        dispatch(
          toast(
            `Found ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}.`,
            'success'
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'set-error', message });
        dispatch(toast(message, 'error'));
      }
    },

    async analyzeCustomWord(): Promise<void> {
      const state = getState();
      const word = state.wordText.trim();
      const context = state.contextText.trim() || state.inputText.trim();
      if (!word || state.status === 'analyzing' || state.status === 'saving') {
        return;
      }

      dispatch({
        type: 'set-status',
        status: 'analyzing',
        message: 'Analyzing selected word with context...',
      });

      try {
        const candidates = await analyzeWithOllama(config, word, {
          mode: 'word',
          contextText: context,
        });
        dispatch({ type: 'set-candidates', candidates });
        dispatch(
          toast(
            `Found ${candidates.length} candidate${candidates.length === 1 ? '' : 's'}.`,
            'success'
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'set-error', message });
        dispatch(toast(message, 'error'));
      }
    },

    async addSelected(): Promise<void> {
      const state = getState();
      const candidate = selectedCandidate(state);
      if (
        !candidate ||
        candidate.status === 'added' ||
        candidate.status === 'skipped' ||
        state.status === 'saving'
      ) {
        return;
      }

      dispatch({
        type: 'set-status',
        status: 'saving',
        message: `Saving ${candidate.expression}...`,
      });

      try {
        const word = candidateToSavedWord(
          candidate,
          state.contextText.trim() || state.inputText.trim()
        );
        await saveWord(config, word);
        dispatch({ type: 'add-saved-word', word });
        dispatch({
          type: 'mark-candidate',
          candidateId: candidate.id,
          status: 'added',
        });
        dispatch({
          type: 'set-status',
          status: 'idle',
          message: `${candidate.expression} saved to Anki import file.`,
        });
        dispatch(toast(`Saved ${candidate.expression}.`, 'success'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'set-error', message });
        dispatch(toast(message, 'error'));
      }
    },

    skipSelected(): void {
      const candidate = selectedCandidate(getState());
      if (!candidate || candidate.status === 'added') return;
      dispatch({
        type: 'toggle-candidate-inbox',
        candidateId: candidate.id,
      });
      dispatch(
        toast(
          candidate.status === 'skipped'
            ? `${candidate.expression} back in inbox.`
            : `${candidate.expression} removed from inbox.`,
          candidate.status === 'skipped' ? 'info' : 'warning'
        )
      );
    },

    clearMine(): void {
      dispatch({ type: 'clear-mine' });
    },

    pasteClipboard(): void {
      const text = readClipboard();
      if (!text) {
        dispatch(toast('Clipboard is unavailable.', 'warning'));
        return;
      }
      dispatch({ type: 'append-input', text });
    },

    async exportAnki(): Promise<void> {
      try {
        const path = await writeAnkiImport(config, getState().savedWords);
        dispatch(toast(`Wrote ${path}.`, 'success'));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ type: 'set-error', message });
        dispatch(toast(message, 'error'));
      }
    },

    navigate: deps.navigate,
    stop: deps.stop,
  };
}
