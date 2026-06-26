import type {
  AnalysisInputMode,
  MiningCandidate,
  MiningCandidateStatus,
  SavedWord,
  WakaruConfig,
} from '@/core/types.js';

export type {
  AnalysisInputMode,
  AnkiFieldConfig,
  AnkiFieldValues,
  MiningCandidate,
  MiningCandidateStatus,
  SavedWord,
  WakaruConfig,
} from '@/core/types.js';

export type MiningStatus = 'idle' | 'analyzing' | 'saving' | 'error';

export type WakaruToast = Readonly<{
  id: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  durationMs: number;
}>;

export type WakaruState = Readonly<{
  nowMs: number;
  viewportCols: number;
  viewportRows: number;
  config: WakaruConfig;
  inputText: string;
  contextText: string;
  wordText: string;
  inputMode: AnalysisInputMode;
  showDetails: boolean;
  status: MiningStatus;
  statusMessage: string;
  errorMessage: string | null;
  candidates: readonly MiningCandidate[];
  selectedCandidateId: string | null;
  savedWords: readonly SavedWord[];
  showCommandPalette: boolean;
  commandQuery: string;
  commandIndex: number;
  toasts: readonly WakaruToast[];
}>;

export type WakaruAction =
  | Readonly<{ type: 'tick'; nowMs: number }>
  | Readonly<{ type: 'set-viewport'; cols: number; rows: number }>
  | Readonly<{ type: 'set-input'; text: string }>
  | Readonly<{ type: 'append-input'; text: string }>
  | Readonly<{ type: 'set-context'; text: string }>
  | Readonly<{ type: 'set-custom-word'; text: string }>
  | Readonly<{ type: 'set-input-mode'; mode: AnalysisInputMode }>
  | Readonly<{ type: 'toggle-details' }>
  | Readonly<{ type: 'clear-mine' }>
  | Readonly<{ type: 'set-status'; status: MiningStatus; message?: string }>
  | Readonly<{ type: 'set-error'; message: string }>
  | Readonly<{ type: 'set-candidates'; candidates: readonly MiningCandidate[] }>
  | Readonly<{ type: 'select-candidate'; candidateId: string | null }>
  | Readonly<{
      type: 'mark-candidate';
      candidateId: string;
      status: MiningCandidateStatus;
    }>
  | Readonly<{ type: 'toggle-candidate-inbox'; candidateId: string }>
  | Readonly<{ type: 'set-saved-words'; words: readonly SavedWord[] }>
  | Readonly<{ type: 'add-saved-word'; word: SavedWord }>
  | Readonly<{ type: 'toggle-command-palette' }>
  | Readonly<{ type: 'set-command-query'; query: string }>
  | Readonly<{ type: 'set-command-index'; index: number }>
  | Readonly<{ type: 'add-toast'; toast: WakaruToast }>
  | Readonly<{ type: 'dismiss-toast'; toastId: string }>
  | Readonly<{ type: 'prune-toasts'; nowMs: number }>;

export type WakaruRouteId = 'mine' | 'library' | 'settings';

export type WakaruRouteDeps = Readonly<{
  dispatch: (action: WakaruAction) => void;
  analyzeInput: () => void;
  analyzeCustomWord: () => void;
  addSelected: () => void;
  skipSelected: () => void;
  clearMine: () => void;
  pasteClipboard: () => void;
  exportAnki: () => void;
  navigate: (routeId: WakaruRouteId) => void;
  routes: readonly Readonly<{ id: WakaruRouteId; title: string }>[];
  stop: () => void;
}>;
