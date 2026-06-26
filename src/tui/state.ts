import type {
  MiningCandidate,
  MiningCandidateStatus,
  SavedWord,
  TuiMiningStatus,
  TuiState,
  TuiToast,
  WakaruConfig,
} from './types.js';

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
  config: WakaruConfig,
  nowMs = Date.now(),
  viewport: Readonly<{ cols: number; rows: number }> = { cols: 120, rows: 40 },
  savedWords: readonly SavedWord[] = []
): TuiState {
  return {
    nowMs,
    viewportCols: clampInt(viewport.cols, 40, 300),
    viewportRows: clampInt(viewport.rows, 18, 200),
    config,
    contextText: '',
    wordText: '',
    showDetails: false,
    status: 'idle',
    statusMessage: 'Paste a word, optionally add context, then analyze.',
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

export function selectedCandidate(state: TuiState): MiningCandidate | null {
  return (
    state.candidates.find(
      (candidate) => candidate.id === state.selectedCandidateId
    ) ?? null
  );
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

export function setStatus(
  state: TuiState,
  status: TuiMiningStatus,
  message = state.statusMessage
): TuiState {
  return {
    ...state,
    status,
    statusMessage: message,
    errorMessage: status === 'error' ? state.errorMessage : null,
  };
}

export function setError(state: TuiState, message: string): TuiState {
  return {
    ...state,
    status: 'error',
    statusMessage: 'Action failed.',
    errorMessage: message,
  };
}

export function setCandidates(
  state: TuiState,
  candidates: readonly MiningCandidate[]
): TuiState {
  return {
    ...state,
    candidates,
    selectedCandidateId: candidates[0]?.id ?? null,
    showDetails: false,
    status: 'idle',
    statusMessage: candidates.length
      ? 'Review the word meaning, then add or skip it.'
      : 'No meaning found. Try adding a context sentence.',
    errorMessage: null,
  };
}

export function selectCandidate(
  state: TuiState,
  candidateId: string | null
): TuiState {
  return { ...state, selectedCandidateId: candidateId };
}

export function markCandidate(
  state: TuiState,
  candidateId: string,
  status: MiningCandidateStatus
): TuiState {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.id === candidateId ? { ...candidate, status } : candidate
    ),
  };
}

export function toggleCandidateInbox(
  state: TuiState,
  candidateId: string
): TuiState {
  return {
    ...state,
    candidates: state.candidates.map((candidate) =>
      candidate.id === candidateId
        ? {
            ...candidate,
            status: candidate.status === 'skipped' ? 'pending' : 'skipped',
          }
        : candidate
    ),
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

export function clearMine(state: TuiState): TuiState {
  return {
    ...state,
    contextText: '',
    wordText: '',
    candidates: [],
    selectedCandidateId: null,
    showDetails: false,
    status: 'idle',
    statusMessage: 'Paste a word, optionally add context, then analyze.',
    errorMessage: null,
  };
}
