import type { ClientConfig } from '@/client/schema/config.js';
import type { ClientCandidate, SavedWord } from '@/client/types.js';
import type { TuiCommandId } from '../commands.js';

export type MiningCandidate = ClientCandidate;
export type { SavedWord } from '@/client/types.js';
export type { ClientConfig } from '@/client/schema/config.js';

export type TuiMiningStatus = 'idle' | 'analysing' | 'saving' | 'error';

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
  config: ClientConfig;
  wordsDir: string;
  savedWords: readonly SavedWord[];
  toasts: readonly TuiToast[];
}>;

export type ChatContextItem =
  | Readonly<{ kind: 'candidate'; value: MiningCandidate }>
  | Readonly<{ kind: 'saved-word'; value: SavedWord }>;

export type TuiPrimaryRouteId = 'mine' | 'library' | 'chat' | 'settings';

export type TuiReturnRoute =
  | Readonly<{ id: 'mine' }>
  | Readonly<{ id: 'library' }>
  | Readonly<{
      id: 'chat';
      sessionId?: string | undefined;
      contexts?: readonly ChatContextItem[] | undefined;
    }>;

export type TuiRoute =
  | Readonly<{ id: 'mine' }>
  | Readonly<{ id: 'library' }>
  | Readonly<{ id: 'settings' }>
  | Readonly<{
      id: 'chat';
      sessionId?: string | undefined;
      contexts?: readonly ChatContextItem[] | undefined;
    }>
  | Readonly<{
      id: 'word-detail';
      item: ChatContextItem;
      returnTo?: TuiReturnRoute | undefined;
    }>;

export type TuiRouteId = TuiRoute['id'];
export type TuiRouteTarget = TuiPrimaryRouteId | TuiRoute;

export type TuiCommandRunner = (commandId: TuiCommandId) => Promise<boolean>;
