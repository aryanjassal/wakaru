import type {
  ChatGenerationOptions,
  ChatMessage,
  ChatResponse,
  AssistantCandidate,
  AssistantCandidateExtension,
} from './types.js';
import type {
  AnalyseVocabularyInput,
  AnalyseVocabularyResult,
  VocabularyInput,
  VocabularyService,
} from './services/vocabulary.js';
import type { LLMAvailability } from './services/model.js';

export interface ConversationService {
  readonly availability: LLMAvailability;
  checkHealth(): Promise<boolean>;
  chat(
    contexts: readonly AssistantCandidate[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse<AssistantCandidateExtension>>;
}

export type WakaruServices<
  Input extends VocabularyInput = AnalyseVocabularyInput,
> = Readonly<{
  vocabulary: VocabularyService<Input>;
  conversation: ConversationService;
}>;

export class Wakaru<Input extends VocabularyInput = AnalyseVocabularyInput> {
  public constructor(private readonly services: WakaruServices<Input>) {}

  public get llmAvailability(): LLMAvailability {
    return this.services.conversation.availability;
  }

  public get llmAvailable(): boolean {
    return this.llmAvailability === 'available';
  }

  public checkHealth(): Promise<boolean> {
    return this.services.conversation.checkHealth();
  }

  public analyseVocabulary(input: Input): Promise<AnalyseVocabularyResult> {
    return this.services.vocabulary.analyse(input);
  }

  public prepareVocabulary(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate> {
    return this.services.vocabulary.prepare(candidate, context);
  }

  public chat(
    contexts: readonly AssistantCandidate[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse<AssistantCandidateExtension>> {
    return this.services.conversation.chat(contexts, messages, options);
  }
}
