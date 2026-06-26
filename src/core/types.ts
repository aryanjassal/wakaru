export type ThemeName = 'night';

export type MiningCandidateStatus = 'pending' | 'added' | 'skipped';

export type AnalysisInputMode = 'auto' | 'word' | 'sentence';

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
  }>;
  anki: Readonly<{
    fields: readonly AnkiFieldConfig[];
  }>;
  analysis: Readonly<{
    sentenceModeThreshold: number;
  }>;
}>;
