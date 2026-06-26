import type { MiningCandidate, SavedWord, WakaruConfig } from '@/core/types.js';

export type {
  AnkiFieldConfig,
  AnkiFieldValues,
  MiningCandidate,
  MiningCandidateStatus,
  SavedWord,
  WakaruConfig,
} from '@/core/types.js';

export type TuiMiningStatus = 'idle' | 'analyzing' | 'saving' | 'error';

export type TuiToast = Readonly<{
  id: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  durationMs: number;
}>;

export type TuiState = Readonly<{
  nowMs: number;
  viewportCols: number;
  viewportRows: number;
  config: WakaruConfig;
  contextText: string;
  wordText: string;
  showDetails: boolean;
  status: TuiMiningStatus;
  statusMessage: string;
  errorMessage: string | null;
  candidates: readonly MiningCandidate[];
  selectedCandidateId: string | null;
  savedWords: readonly SavedWord[];
  showCommandPalette: boolean;
  commandQuery: string;
  commandIndex: number;
  toasts: readonly TuiToast[];
}>;

export type TuiRouteId = 'mine' | 'library' | 'settings';

export type TuiStateUpdater = (update: (state: TuiState) => TuiState) => void;

export type TuiCommandRunner = (commandId: string) => Promise<boolean>;

export type TuiCommandContext = Readonly<{
  getState: () => TuiState;
  setState: TuiStateUpdater;
  syncInputs: () => void;
  navigate: (routeId: TuiRouteId) => void;
  getRoute: () => TuiRouteId;
  navigateOffset: (offset: 1 | -1) => void;
  stop: () => Promise<void>;
  runCommand: TuiCommandRunner;
}>;
