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
  JapaneseVocabulary,
} from './vocabulary.js';
import type { Assistant } from './assistant.js';
import type { LLMAvailability } from './model.js';

export class Wakaru {
  public constructor(
    private readonly vocabulary: JapaneseVocabulary,
    private readonly assistant: Assistant
  ) {}

  public get llmAvailability(): LLMAvailability {
    return this.assistant.availability;
  }

  public get llmAvailable(): boolean {
    return this.llmAvailability === 'available';
  }

  public checkHealth(): Promise<boolean> {
    return this.assistant.checkHealth();
  }

  public analyseVocabulary(
    input: AnalyseVocabularyInput
  ): Promise<AnalyseVocabularyResult> {
    return this.vocabulary.analyse(input);
  }

  public prepareVocabulary(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate> {
    return this.vocabulary.prepare(candidate, context);
  }

  public chat(
    contexts: readonly AssistantCandidate[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse<AssistantCandidateExtension>> {
    return this.assistant.chat(contexts, messages, options);
  }
}
