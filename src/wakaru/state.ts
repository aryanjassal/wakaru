import { cycleThemeName } from '../theme.js';
import type {
  MiningCandidate,
  SavedWord,
  WakaruAction,
  WakaruConfig,
  WakaruState,
  WakaruToast,
} from '../types.js';

const TOAST_LIMIT = 6;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function withToast(
  state: WakaruState,
  toast: WakaruToast
): readonly WakaruToast[] {
  const next = [...state.toasts.filter((item) => item.id !== toast.id), toast];
  if (next.length > TOAST_LIMIT) next.splice(0, next.length - TOAST_LIMIT);
  return next;
}

export function createInitialWakaruState(
  config: WakaruConfig,
  nowMs = Date.now(),
  viewport: Readonly<{ cols: number; rows: number }> = { cols: 120, rows: 40 },
  savedWords: readonly SavedWord[] = []
): WakaruState {
  return {
    nowMs,
    viewportCols: clampInt(viewport.cols, 40, 300),
    viewportRows: clampInt(viewport.rows, 18, 200),
    themeName: config.theme.name,
    config,
    inputText: '',
    status: 'idle',
    statusMessage: 'Paste a Japanese sentence or word list, then analyze.',
    errorMessage: null,
    candidates: [],
    selectedCandidateId: null,
    savedWords,
    showCommandPalette: false,
    commandQuery: '',
    commandIndex: 0,
    toasts: [],
  };
}

export function selectedCandidate(state: WakaruState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
}

export function reduceWakaruState(
  state: WakaruState,
  action: WakaruAction
): WakaruState {
  if (action.type === 'tick') {
    return { ...state, nowMs: action.nowMs };
  }
  if (action.type === 'set-viewport') {
    return {
      ...state,
      viewportCols: clampInt(action.cols, 40, 300),
      viewportRows: clampInt(action.rows, 18, 200),
    };
  }
  if (action.type === 'cycle-theme') {
    return {
      ...state,
      themeName: cycleThemeName(state.themeName),
    };
  }
  if (action.type === 'set-input') {
    return { ...state, inputText: action.text };
  }
  if (action.type === 'set-status') {
    return {
      ...state,
      status: action.status,
      statusMessage: action.message ?? state.statusMessage,
      errorMessage: action.status === 'error' ? state.errorMessage : null,
    };
  }
  if (action.type === 'set-error') {
    return {
      ...state,
      status: 'error',
      statusMessage: 'Action failed.',
      errorMessage: action.message,
    };
  }
  if (action.type === 'set-candidates') {
    const candidates = action.candidates;
    return {
      ...state,
      candidates,
      selectedCandidateId: candidates[0]?.id ?? null,
      status: 'idle',
      statusMessage: candidates.length
        ? 'Review candidates, then add or skip each one.'
        : 'No candidates found. Try adding more context.',
      errorMessage: null,
    };
  }
  if (action.type === 'select-candidate') {
    return { ...state, selectedCandidateId: action.candidateId };
  }
  if (action.type === 'mark-candidate') {
    return {
      ...state,
      candidates: state.candidates.map((candidate) =>
        candidate.id === action.candidateId
          ? { ...candidate, status: action.status }
          : candidate
      ),
    };
  }
  if (action.type === 'set-saved-words') {
    return {
      ...state,
      savedWords: action.words,
    };
  }
  if (action.type === 'add-saved-word') {
    return {
      ...state,
      savedWords: [action.word, ...state.savedWords],
    };
  }
  if (action.type === 'toggle-command-palette') {
    return {
      ...state,
      showCommandPalette: !state.showCommandPalette,
      commandQuery: '',
      commandIndex: 0,
    };
  }
  if (action.type === 'set-command-query') {
    return {
      ...state,
      commandQuery: action.query,
      commandIndex: 0,
    };
  }
  if (action.type === 'set-command-index') {
    return { ...state, commandIndex: action.index };
  }
  if (action.type === 'add-toast') {
    return { ...state, toasts: withToast(state, action.toast) };
  }
  if (action.type === 'dismiss-toast') {
    return {
      ...state,
      toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
    };
  }
  if (action.type === 'prune-toasts') {
    return {
      ...state,
      toasts: state.toasts.filter(
        (toast) => action.nowMs - toast.timestamp < toast.durationMs
      ),
    };
  }
  return state;
}
