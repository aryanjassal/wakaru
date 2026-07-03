export type VocabularyExample = Readonly<{
  japanese: string;
  english?: string | undefined;
}>;

export type CandidateProvenance = Readonly<{
  definition?: string | undefined;
  example?: string | undefined;
}>;

export type CandidateDetails = Readonly<{
  contextMeaning?: string | undefined;
  partOfSpeech?: readonly string[] | undefined;
  nuance?: string | undefined;
  example?: VocabularyExample | undefined;
  provenance?: CandidateProvenance | undefined;
}>;

export type MiningCandidate<Extension extends object = Record<never, never>> =
  Readonly<{
    id: string;
    expression: string;
    reading?: string | undefined;
    meanings: readonly string[];
    details?: CandidateDetails | undefined;
    extension?: Readonly<Extension> | undefined;
  }>;

export type AssistantCandidateExtension = Readonly<{
  tags: readonly string[];
  exportFields: Readonly<Record<string, string>>;
}>;

export type AssistantCandidate = MiningCandidate<AssistantCandidateExtension>;

export type ChatMessage = Readonly<{
  role: 'user' | 'assistant';
  content: string;
}>;

export type ChatResponse<Extension extends object = Record<never, never>> =
  Readonly<{
    markdown: string;
    candidate?: MiningCandidate<Extension> | undefined;
  }>;

export type ChatGenerationOptions = Readonly<{
  temperature?: number | undefined;
}>;
