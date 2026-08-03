import type {
  AnalyseVocabularyInput,
  AnalyseVocabularyResult,
} from '@/wakaru/vocabulary.js';
import type { AssistantCandidate } from '@/wakaru/types.js';
import type { ClientConfig } from '@/wakaru/schema/config.js';
import type { SavedWord } from '@/wakaru/types.js';

export type SavePreparedWordInput = Readonly<{
  candidate: AssistantCandidate;
  sourceText: string;
  context?: string | undefined;
}>;

export type WakaruElectronApi = Readonly<{
  loadConfig: () => Promise<ClientConfig>;
  writeConfig: (config: ClientConfig) => Promise<void>;
  checkHealth: () => Promise<boolean>;
  analyseVocabulary: (
    input: AnalyseVocabularyInput
  ) => Promise<AnalyseVocabularyResult>;
  prepareVocabulary: (
    candidate: AssistantCandidate,
    context?: string
  ) => Promise<AssistantCandidate>;
  listWords: () => Promise<readonly SavedWord[]>;
  saveWord: (input: SavePreparedWordInput) => Promise<SavedWord>;
  exportTsv: () => Promise<string>;
}>;

declare global {
  interface Window {
    wakaru: WakaruElectronApi;
  }
}
