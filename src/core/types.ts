import type { AnkiFormattingConfig } from './formatting-types.js';

export type ThemeName = 'night';

export type MiningCandidateStatus = 'pending' | 'added';

export type AnkiFieldConfig = Readonly<{
  name: string;
  purpose: string;
  optional?: boolean | undefined;
}>;

export type AnkiFieldValues = Readonly<Record<string, string>>;

export type MiningCandidate = Readonly<{
  id: string;
  expression: string;
  reading: string;
  meaning: string;
  contextMeaning: string;
  partOfSpeech: string;
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

export type ChatMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type ChatResponse = Readonly<{
  markdown: string;
  candidate?: MiningCandidate | undefined;
}>;

export type ChatGenerationOptions = Readonly<{
  temperature?: number | undefined;
}>;

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
  anki: Readonly<{
    fields: readonly AnkiFieldConfig[];
    formatting: AnkiFormattingConfig;
  }>;
}>;

export type {
  AnkiFormattingConfig,
  FormattedTextToken,
} from './formatting-types.js';
