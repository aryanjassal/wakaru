import type {
  ChatGenerationOptions,
  ChatMessage,
  ChatResponse,
  MiningCandidate,
  SavedWord,
} from './types.js';
import type {
  AnalyseVocabularyInput,
  AnalyseVocabularyResult,
  VocabularyInput,
  VocabularyService,
} from './vocabulary.js';

export interface ConversationService {
  chat(
    contexts: readonly (MiningCandidate | SavedWord)[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse>;
}

export type WakaruServices<
  Input extends VocabularyInput = AnalyseVocabularyInput,
> = Readonly<{
  vocabulary: VocabularyService<Input>;
  conversation: ConversationService;
}>;

export class Wakaru<Input extends VocabularyInput = AnalyseVocabularyInput> {
  constructor(private readonly services: WakaruServices<Input>) {}

  public analyseVocabulary(input: Input): Promise<AnalyseVocabularyResult> {
    return this.services.vocabulary.analyse(input);
  }

  public prepareVocabulary(
    candidate: MiningCandidate,
    context?: string
  ): Promise<MiningCandidate> {
    return this.services.vocabulary.prepare(candidate, context);
  }

  public chat(
    contexts: readonly (MiningCandidate | SavedWord)[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse> {
    return this.services.conversation.chat(contexts, messages, options);
  }
}
