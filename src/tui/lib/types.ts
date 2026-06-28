import type { SavedWord, WakaruConfig } from '@/core/types.js';
import type { TuiCommandId } from '../commands.js';

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
  savedWords: readonly SavedWord[];
  toasts: readonly TuiToast[];
}>;

export type TuiRouteId = 'mine' | 'library' | 'settings';

export type TuiCommandRunner = (commandId: TuiCommandId) => Promise<boolean>;
