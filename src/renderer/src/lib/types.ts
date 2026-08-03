import type { ClientConfig } from '@/wakaru/schema/config.js';
import type { SavedWord } from '@/wakaru/types.js';

export type AppContext = Readonly<{
  config: ClientConfig | null;
  words: readonly SavedWord[];
  sortedWords: readonly SavedWord[];
  exporting: boolean;
  setConfig: (config: ClientConfig) => void;
  addSavedWord: (word: SavedWord) => void;
  exportTsv: () => Promise<void>;
}>;
