import type { ClientConfig, SavedWord, TuiState, TuiToast } from './types.js';

const TOAST_LIMIT = 6;

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function withToast(state: TuiState, toast: TuiToast): readonly TuiToast[] {
  const next = [...state.toasts.filter((item) => item.id !== toast.id), toast];
  if (next.length > TOAST_LIMIT) next.splice(0, next.length - TOAST_LIMIT);
  return next;
}

export function createInitialTuiState(
  config: ClientConfig,
  wordsDir: string,
  nowMs = Date.now(),
  viewport: Readonly<{ cols: number; rows: number }> = { cols: 120, rows: 40 },
  savedWords: readonly SavedWord[] = []
): TuiState {
  return {
    nowMs,
    viewportCols: clampInt(viewport.cols, 40, 300),
    viewportRows: clampInt(viewport.rows, 18, 200),
    config,
    wordsDir,
    savedWords,
    toasts: [],
  };
}

export function createToast(
  message: string,
  level: TuiToast['level'] = 'info'
): TuiToast {
  return {
    id: `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    message,
    level,
    timestamp: Date.now(),
    durationMs: 3200,
  };
}

export function setViewport(
  state: TuiState,
  cols: number,
  rows: number
): TuiState {
  return {
    ...state,
    viewportCols: clampInt(cols, 40, 300),
    viewportRows: clampInt(rows, 18, 200),
  };
}

export function addSavedWord(state: TuiState, word: SavedWord): TuiState {
  return {
    ...state,
    savedWords: [word, ...state.savedWords],
  };
}

export function addToast(state: TuiState, toast: TuiToast): TuiState {
  return { ...state, toasts: withToast(state, toast) };
}

export function pruneToasts(state: TuiState, nowMs: number): TuiState {
  return {
    ...state,
    toasts: state.toasts.filter(
      (toast) => nowMs - toast.timestamp < toast.durationMs
    ),
  };
}
