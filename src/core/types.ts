export type MiningCandidateStatus = 'pending' | 'added';

export type ExportFieldConfig = Readonly<{
  name: string;
  purpose: string;
  optional?: boolean | undefined;
}>;

export type ExportFieldValues = Readonly<Record<string, string>>;

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
  exportFields: ExportFieldValues;
  definitionSource?: string | undefined;
  exampleSource?: string | undefined;
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

export type {
  HtmlFormattingConfig,
  FormattedTextToken,
} from './formatting-types.js';
