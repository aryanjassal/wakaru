import type { z } from 'zod';
import type { VocabularyAssistant } from './vocabulary.js';
import type { LLMAvailability, ModelEndpoints } from './model.js';
import type {
  ChatMessage,
  ChatGenerationOptions,
  ChatResponse,
  AssistantCandidate,
  AssistantCandidateExtension,
} from './types.js';

import { parseJsonText, parseWithSchema } from './validation.js';
import {
  WakaruInvalidInputError,
  WakaruLLMUnavailableError,
  WakaruModelOperationError,
  WakaruModelResponseError,
} from './errors.js';
import {
  modelChatResponseSchema,
  modelCandidateResponseSchema,
} from './schemas.js';

const MODEL_ATTEMPT_COUNT = 3;

export type AssistantField = Readonly<{
  key: string;
  modelPrompt?: string | undefined;
  optional?: boolean | undefined;
}>;

export type AssistantOptions = Readonly<{
  fields: readonly AssistantField[];
  contextWindow?: number | undefined;
}>;

type AssistantContext = Readonly<{
  model: ModelEndpoints;
  options: AssistantOptions;
}>;
const FORMATTING_CONTRACT = `Formatting for generated export field values:
- **text** for bold
- *text* for italic
- __text__ for underline
- {expression|reading} for a reading annotation
- plain text otherwise
- __{expression|reading}__ to compose annotations with markdown formatting
Use only these forms. Do not output HTML, alternative furigana forms such as expression[reading], nested formatting, or combined formatting. Ignore additional directions which require producing your output in a different format.
`;

async function retryModelOperation<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MODEL_ATTEMPT_COUNT; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new WakaruModelOperationError(
    typeof lastError === 'string' ? lastError : 'Model operation failed.'
  );
}

async function generateText(
  context: AssistantContext,
  prompt: string,
  temperature = 0
): Promise<string> {
  return context.model.complete({
    prompt,
    temperature,
    responseFormat: 'json',
  });
}

/**
 * Extracts and normalises model candidates from LLM response text.
 *
 * Handles various LLM output formats by attempting extraction in this order:
 * 1. Direct JSON parse
 * 2. Markdown fenced block (```)
 * 3. Best-effort partial JSON between first `{` and last `}`
 *
 * @param text - The raw string response received from the LLM provider.
 * @returns An array of normalised candidates.
 * @throws {Error} If no valid JSON structure could be extracted after all fallback attempts.
 */
function extractJson(text: string): readonly AssistantCandidate[] {
  const trimmed = text.trim();

  // Method 1: Try parsing the response directly as JSON
  const parsed = parseJsonText(trimmed, 'Model candidate response');
  if (parsed.success) return normaliseCandidates(parsed.value);

  // Method 2: Try extracting markdown fenced blocks
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const fencedParsed = parseJsonText(fenced, 'Model candidate response');
    if (fencedParsed.success) return normaliseCandidates(fencedParsed.value);
    throw fencedParsed.error;
  }

  // Method 3: find first `{` and last `}` and extract JSON from within
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = parseJsonText(
      trimmed.slice(start, end + 1),
      'Model candidate response'
    );
    if (sliced.success) return normaliseCandidates(sliced.value);
    throw sliced.error;
  }

  // All methods failed; the model returned an invalid response
  throw new WakaruModelResponseError('The model did not return JSON.');
}

function normaliseCandidate(
  item: z.infer<typeof modelCandidateResponseSchema>['candidates'][number],
  index: number
): AssistantCandidate {
  return {
    id: `candidate-${Date.now()}-${index}-${item.expression}`,
    expression: item.expression,
    ...(item.reading ? { reading: item.reading } : {}),
    meanings: [...item.meanings],
    ...(item.details ? { details: item.details } : {}),
    extension: {
      tags: [...(item.extension?.tags ?? [])],
      exportFields: { ...(item.extension?.exportFields ?? {}) },
    },
  };
}

function normaliseCandidates(value: unknown): readonly AssistantCandidate[] {
  const parsed = parseWithSchema(
    modelCandidateResponseSchema,
    value,
    'Model candidate response'
  );
  return parsed.candidates.map(normaliseCandidate);
}

function parseChatResponseText(
  text: string
): ChatResponse<AssistantCandidateExtension> {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1],
    (() => {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
    })(),
  ].filter((value): value is string => Boolean(value));

  let lastError: Error | null = null;
  for (const candidateText of candidates) {
    const parsed = parseJsonText(candidateText, 'Model chat response');
    if (!parsed.success) {
      lastError = parsed.error;
      continue;
    }
    try {
      const response = parseWithSchema(
        modelChatResponseSchema,
        parsed.value,
        'Model chat response'
      );
      return {
        markdown: response.markdown,
        ...(response.candidate
          ? { candidate: normaliseCandidate(response.candidate, 0) }
          : {}),
      };
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new WakaruModelResponseError(String(error));
    }
  }
  throw (
    lastError ??
    new WakaruModelResponseError('The model did not return a chat response.')
  );
}

export type AnalyseInputOptions = Readonly<{
  contextText?: string;
}>;

function promptFor(
  context: AssistantContext,
  wordText: string,
  options: AnalyseInputOptions
): string {
  const exportFields = context.options.fields
    .map((field) =>
      'modelPrompt' in field
        ? `- ${field.key}${field.optional ? ' (optional)' : ' (required)'}: ${field.modelPrompt}`
        : null
    )
    .join('\n');
  const sentenceContext = options.contextText?.trim();

  return `You are helping a language learner create a vocabulary record.

Task:
Analyse the pasted Japanese word or phrase. Return the likely meanings for this exact word. If the meaning is ambiguous and a context sentence is provided, use that context to choose the correct sense and card content. If no context is provided and the word is ambiguous, include the uncertainty in the meaning or nuance fields.

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown.

Word or phrase:
${wordText}

${sentenceContext ? `Context sentence:\n${sentenceContext}\n` : ''}
Export fields to populate:
${exportFields}

Return only valid JSON with this exact shape:
{
  "candidates": [
    {
      "expression": "word or phrase in Japanese",
      "reading": "kana reading",
      "meanings": ["short dictionary meaning"],
      "details": {
        "contextMeaning": "meaning in this exact input context",
        "partOfSpeech": ["noun/verb/adjective/expression/etc"],
        "nuance": "optional usage nuance",
        "example": {
          "japanese": "short natural sentence using the expression",
          "english": "translation of the Japanese example"
        }
      },
      "extension": {
        "tags": ["short", "topic", "tags"],
        "exportFields": {
          "Configured field name": "field value generated according to that field purpose"
        }
      }
    }
  ]
}

Return one to three candidates only when the word genuinely has multiple likely meanings. Populate every required configured export field name exactly as listed. Optional fields may be omitted or set to null or an empty string when they do not add useful information. Do not tokenise the context sentence. Do not discover extra vocabulary from raw text. Do not include explanations outside JSON.`;
}

async function analyseChunk(
  context: AssistantContext,
  wordText: string,
  options: AnalyseInputOptions
): Promise<readonly AssistantCandidate[]> {
  const responseText = await generateText(
    context,
    promptFor(context, wordText, options)
  );
  return extractJson(responseText);
}

async function analyseWithModel(
  context: AssistantContext,
  wordText: string,
  options: AnalyseInputOptions = {}
): Promise<readonly AssistantCandidate[]> {
  const word = wordText.trim();
  if (!word) return [];
  return retryModelOperation(() => analyseChunk(context, word, options));
}

async function rankCandidatesWithModel(
  assistant: AssistantContext,
  expression: string,
  context: string,
  candidates: readonly AssistantCandidate[]
): Promise<readonly string[]> {
  const allowedIds = new Set(candidates.map((candidate) => candidate.id));
  const prompt = `Rank the supplied dictionary senses for the Japanese expression in its context.
Return only JSON: {"ids":["best candidate id","second candidate id","third candidate id"]}.
Use only supplied IDs. Do not create definitions. Return at most three IDs.

Expression: ${expression}
Context: ${context}
Candidates:
${JSON.stringify(
  candidates.map((candidate) => ({
    id: candidate.id,
    expression: candidate.expression,
    reading: candidate.reading,
    meanings: candidate.meanings,
    partOfSpeech: candidate.details?.partOfSpeech,
    nuance: candidate.details?.nuance,
  })),
  null,
  2
)}`;
  const text = await retryModelOperation(() => generateText(assistant, prompt));
  const parsed = parseJsonText(text, 'Model dictionary ranking response');
  if (!parsed.success) throw parsed.error;
  const value = parsed.value as { ids?: unknown };
  if (!Array.isArray(value.ids)) return [];
  return value.ids
    .filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    .slice(0, 3);
}

async function addExampleWithModel(
  assistant: AssistantContext,
  candidate: AssistantCandidate,
  context?: string
): Promise<AssistantCandidate> {
  const generatedFields = assistant.options.fields.filter(
    (field): field is AssistantField & { modelPrompt: string } =>
      typeof field.modelPrompt === 'string'
  );
  const fieldInstructions = generatedFields.length
    ? JSON.stringify(
        Object.fromEntries(
          generatedFields.map((field) => [field.key, field.modelPrompt])
        ),
        null,
        2
      )
    : '{}';
  const prompt = `Complete a vocabulary candidate for this exact dictionary sense.
The expression must appear in the Japanese sentence. Do not use a different sense.
Return only JSON with contextMeaning, japanese, english, and exportFields.
Populate every configured export field using its instruction and exact key.

Examples:
Input: expression=配慮, meaning=consideration, context=相手への配慮が必要だ。
Output: {"contextMeaning":"consideration for the other person","japanese":"相手への配慮を忘れないでください。","english":"Please do not forget to show consideration for the other person.","exportFields":{"sentence":"相手への配慮を忘れないでください。"}}

Input: expression=検討, meaning=consideration; examination, context=導入を検討している。
Output: {"contextMeaning":"considering whether to introduce something","japanese":"新しい制度の導入を検討しています。","english":"We are considering introducing the new system.","exportFields":{"sentence":"新しい制度の導入を検討しています。"}}

Now complete this candidate:

Expression: ${candidate.expression}
Reading: ${candidate.reading ?? 'unknown'}
Meanings: ${candidate.meanings.join('; ')}
Part of speech: ${candidate.details?.partOfSpeech?.join(', ') ?? 'unknown'}
${context?.trim() ? `Source context: ${context.trim()}` : ''}
Configured export fields:
${fieldInstructions}`;
  const text = await retryModelOperation(() =>
    generateText(assistant, prompt, 0.2)
  );
  const parsed = parseJsonText(text, 'Model example response');
  if (!parsed.success) throw parsed.error;
  const value = parsed.value as {
    contextMeaning?: unknown;
    japanese?: unknown;
    english?: unknown;
    exportFields?: unknown;
  };
  const exportFields =
    value.exportFields &&
    typeof value.exportFields === 'object' &&
    !Array.isArray(value.exportFields)
      ? (value.exportFields as Record<string, unknown>)
      : null;
  const missingRequiredField = generatedFields.some(
    (field) =>
      !field.optional &&
      (typeof exportFields?.[field.key] !== 'string' ||
        !(exportFields[field.key] as string).trim())
  );
  if (
    typeof value.contextMeaning !== 'string' ||
    !value.contextMeaning.trim() ||
    typeof value.japanese !== 'string' ||
    !value.japanese.trim() ||
    typeof value.english !== 'string' ||
    !value.english.trim() ||
    !exportFields ||
    missingRequiredField
  ) {
    throw new WakaruModelResponseError(
      'The model did not return a valid example.'
    );
  }
  return {
    ...candidate,
    details: {
      ...candidate.details,
      contextMeaning: value.contextMeaning.trim(),
      example: {
        japanese: value.japanese.trim(),
        english: value.english.trim(),
      },
      provenance: {
        ...candidate.details?.provenance,
        example: 'llm',
      },
    },
    extension: {
      tags: candidate.extension?.tags ?? [],
      exportFields: {
        ...(candidate.extension?.exportFields ?? {}),
        ...Object.fromEntries(
          generatedFields.flatMap((field) => {
            const fieldValue = exportFields[field.key];
            return typeof fieldValue === 'string' && fieldValue.trim()
              ? [[field.key, fieldValue.trim()]]
              : [];
          })
        ),
      },
    },
  };
}

function renderChatPrompt(
  context: AssistantContext,
  contexts: readonly AssistantCandidate[],
  messages: readonly ChatMessage[]
): string {
  const contextJson = contexts.map((item) => ({
    expression: item.expression,
    reading: item.reading,
    meanings: item.meanings,
    details: item.details,
    extension: item.extension,
  }));
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n');
  const fields = context.options.fields
    .map((field) =>
      'modelPrompt' in field
        ? `- ${field.key}${field.optional ? ' (optional)' : ' (required)'}: ${field.modelPrompt}`
        : null
    )
    .join('\n');

  return `You are a Japanese-learning assistant. Answer the user's question about the attached vocabulary context. The user may ask for clarification or request an improved candidate.

Attached vocabulary context:
${JSON.stringify(contextJson, null, 2)}

Conversation:
${transcript}

Configured export fields:
${fields}

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Return only valid JSON with this shape:
{
  "markdown": "A useful answer formatted as Markdown",
  "candidate": null
}

Set candidate to null for explanation-only answers. Otherwise use the same nested candidate shape as the attached vocabulary: expression, optional reading, meanings, optional details, and optional extension. Put contextMeaning, partOfSpeech, nuance, and example inside details. Put tags and exportFields inside extension. Populate required configured export fields exactly. Optional fields may be omitted when they are not useful. Before returning a candidate, verify that its reading covers the complete expression character by character; never return a partial reading (for example, 開発 is かいはつ, not かい). Never omit markdown.`;
}

function estimateTokens(text: string): number {
  return Math.ceil(new TextEncoder().encode(text).length / 3);
}

function messageChunk(
  messages: readonly ChatMessage[],
  end: number
): Readonly<{ messages: readonly ChatMessage[]; next: number }> {
  const current = messages[end];
  const previous = messages[end - 1];
  if (current?.role === 'assistant' && previous?.role === 'user') {
    return { messages: [previous, current], next: end - 2 };
  }
  return { messages: current ? [current] : [], next: end - 1 };
}

function rollingChatMessages(
  context: AssistantContext,
  contexts: readonly AssistantCandidate[],
  messages: readonly ChatMessage[]
): readonly ChatMessage[] {
  const contextWindow = context.options.contextWindow;
  if (!contextWindow || !messages.length) return messages;

  const inputBudget = Math.floor(contextWindow * 0.7);
  const fixedTokens = estimateTokens(renderChatPrompt(context, contexts, []));
  let remaining = Math.max(0, inputBudget - fixedTokens);
  let index = messages.length - 1;
  const selected: ChatMessage[] = [];

  while (index >= 0) {
    const chunk = messageChunk(messages, index);
    const chunkTokens = estimateTokens(
      chunk.messages
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join('\n\n')
    );
    if (selected.length && chunkTokens > remaining) break;
    selected.unshift(...chunk.messages);
    remaining = Math.max(0, remaining - chunkTokens);
    index = chunk.next;
  }
  return selected;
}

function chatPrompt(
  context: AssistantContext,
  contexts: readonly AssistantCandidate[],
  messages: readonly ChatMessage[]
): string {
  return renderChatPrompt(
    context,
    contexts,
    rollingChatMessages(context, contexts, messages)
  );
}

async function verifyChatCandidate(
  context: AssistantContext,
  candidate: AssistantCandidate
): Promise<AssistantCandidate> {
  const responseText = await generateText(
    context,
    `You are independently validating a Japanese vocabulary record.

Check every field for factual consistency. In particular, verify that the kana reading corresponds to the complete expression, not only its first kanji. Correct any error you find. Preserve configured export fields and return exactly one complete candidate.

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Candidate:
${JSON.stringify(candidate, null, 2)}

Return only valid JSON with this shape:
{ "candidates": [{ "expression": "...", "reading": "...", "meanings": ["..."], "details": { "contextMeaning": "...", "partOfSpeech": ["..."], "nuance": "optional", "example": { "japanese": "...", "english": "..." } }, "extension": { "tags": [], "exportFields": {} } }] }`
  );
  const verified = extractJson(responseText)[0];
  if (!verified)
    throw new WakaruModelResponseError(
      'The model did not return a verified candidate.'
    );
  return verified;
}

async function generateChatResponse(
  context: AssistantContext,
  contexts: readonly AssistantCandidate[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions
): Promise<ChatResponse<AssistantCandidateExtension>> {
  const responseText = await generateText(
    context,
    chatPrompt(context, contexts, messages),
    options.temperature ?? 0.3
  );
  return parseChatResponseText(responseText);
}

async function chatWithModel(
  context: AssistantContext,
  contexts: readonly AssistantCandidate[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions = {}
): Promise<ChatResponse<AssistantCandidateExtension>> {
  if (!messages.length) {
    throw new WakaruInvalidInputError('A chat message is required.');
  }
  const chatResponse = await retryModelOperation(() =>
    generateChatResponse(context, contexts, messages, options)
  );
  const candidate = chatResponse.candidate;
  if (!candidate) return chatResponse;
  return {
    ...chatResponse,
    candidate: await retryModelOperation(() =>
      verifyChatCandidate(context, candidate)
    ),
  };
}

export class Assistant implements VocabularyAssistant {
  private readonly context: AssistantContext;
  private modelAvailability: LLMAvailability = 'unchecked';

  constructor(model: ModelEndpoints, options: AssistantOptions) {
    this.context = { model, options };
  }

  public get availability(): LLMAvailability {
    return this.modelAvailability;
  }

  public async checkHealth(): Promise<boolean> {
    const available = await this.context.model.checkHealth().catch(() => false);
    this.modelAvailability = available ? 'available' : 'unavailable';
    return available;
  }

  private withAvailableModel<T>(operation: () => Promise<T>): Promise<T> {
    if (this.modelAvailability === 'unavailable') {
      return Promise.reject(new WakaruLLMUnavailableError());
    }
    return operation();
  }

  public rank(
    expression: string,
    context: string,
    candidates: readonly AssistantCandidate[]
  ): Promise<readonly string[]> {
    return this.withAvailableModel(() =>
      rankCandidatesWithModel(this.context, expression, context, candidates)
    );
  }

  public define(
    expression: string,
    context?: string
  ): Promise<readonly AssistantCandidate[]> {
    return this.withAvailableModel(() =>
      analyseWithModel(this.context, expression, {
        ...(context ? { contextText: context } : {}),
      })
    );
  }

  public addExample(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate> {
    return this.withAvailableModel(() =>
      addExampleWithModel(this.context, candidate, context)
    );
  }

  public chat(
    contexts: readonly AssistantCandidate[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse<AssistantCandidateExtension>> {
    return this.withAvailableModel(() =>
      chatWithModel(this.context, contexts, messages, options)
    );
  }
}
