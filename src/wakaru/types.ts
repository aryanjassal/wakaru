export type VocabularyExample = Readonly<{
  japanese: string;
  english?: string | undefined;
}>;

export type CandidateDefinitionSource =
  | Readonly<{
      kind: 'dictionary';
      dictionary: string;
      entryId: string;
      senseId: string;
    }>
  | Readonly<{ kind: 'llm' }>
  | Readonly<{ kind: 'manual' }>;

export type CandidateProvenance = Readonly<{
  definition?: CandidateDefinitionSource | undefined;
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

export type ClientCandidateExtension = AssistantCandidateExtension;
export type ClientCandidate = MiningCandidate<ClientCandidateExtension>;

export type SavedWord = Readonly<{
  id: string;
  candidate: ClientCandidate;
  sourceText: string;
  createdAt: string;
}>;
