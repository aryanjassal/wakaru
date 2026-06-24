import type { RegisteredBinding, Toast } from '@rezi-ui/core';

export type ThemeName = 'night' | 'day' | 'custom';

export type MiningStatus = 'idle' | 'analyzing' | 'saving' | 'error';

export type MiningCandidateStatus = 'pending' | 'added' | 'skipped';

export type AnkiFieldConfig = Readonly<{
  name: string;
  purpose: string;
}>;

export type AnkiFieldValues = Readonly<Record<string, string>>;

export type MiningCandidate = Readonly<{
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  contextMeaning: string;
  partOfSpeech: string;
  pitchAccent?: string | undefined;
  nuance?: string | undefined;
  exampleJapanese: string;
  exampleEnglish: string;
  tags: readonly string[];
  ankiFields: AnkiFieldValues;
  status: MiningCandidateStatus;
}>;

export type SavedWord = Readonly<
  Omit<MiningCandidate, 'status'> & {
    sourceText: string;
    createdAt: string;
  }
>;

export type WakaruConfig = Readonly<{
  llm: Readonly<{
    provider: 'ollama';
    model: string;
    apiBase: string;
    maxInputChars: number;
  }>;
  storage: Readonly<{
    wordsDir: string;
  }>;
  theme: Readonly<{
    name: ThemeName;
    customPath: string;
  }>;
  anki: Readonly<{
    fields: readonly AnkiFieldConfig[];
  }>;
}>;

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
  themeName: ThemeName;
  config: WakaruConfig;
  inputText: string;
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
  | Readonly<{ type: 'cycle-theme' }>
  | Readonly<{ type: 'set-input'; text: string }>
  | Readonly<{ type: 'set-status'; status: MiningStatus; message?: string }>
  | Readonly<{ type: 'set-error'; message: string }>
  | Readonly<{ type: 'set-candidates'; candidates: readonly MiningCandidate[] }>
  | Readonly<{ type: 'select-candidate'; candidateId: string | null }>
  | Readonly<{
      type: 'mark-candidate';
      candidateId: string;
      status: MiningCandidateStatus;
    }>
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
  addSelected: () => void;
  skipSelected: () => void;
  exportAnki: () => void;
  navigate: (routeId: WakaruRouteId) => void;
  routes: readonly Readonly<{ id: WakaruRouteId; title: string }>[];
  stop: () => void;
  getBindings?: () => readonly RegisteredBinding[];
}>;

export function toCoreWakaruToast(toast: WakaruToast): Toast {
  return {
    id: toast.id,
    message: toast.message,
    type: toast.level,
    duration: toast.durationMs,
  };
}
