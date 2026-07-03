import type { z } from 'zod';
import type { ConversationService } from './wakaru.js';
import type { VocabularyModel } from './vocabulary.js';
import type { ModelService } from './model.js';
import type {
  ChatMessage,
  ChatGenerationOptions,
  ChatResponse,
  MiningCandidate,
  SavedWord,
} from './types.js';

import { parseJsonText, parseWithSchema } from './utils.js';
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
  maxInputChars: number;
}>;

type AssistantContext = Readonly<{
  model: ModelService;
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
  throw new Error(
    typeof lastError === 'string' ? lastError : 'Model operation failed.'
  );
}

async function generateText(
  context: AssistantContext,
  prompt: string,
  temperature = 0
): Promise<string> {
  return context.model.generate({
    prompt,
    temperature,
    responseFormat: 'json',
  });
}

/**
 * Extracts and normalises a JSON array of `MiningCandidate` from LLM response text.
 *
 * Handles various LLM output formats by attempting extraction in this order:
 * 1. Direct JSON parse
 * 2. Markdown fenced block (```)
 * 3. Best-effort partial JSON between first `{` and last `}`
 *
 * @param text - The raw string response received from the LLM provider.
 * @returns An array of normalised `MiningCandidate` objects.
 * @throws {Error} If no valid JSON structure could be extracted after all fallback attempts.
 */
function extractJson(text: string): readonly MiningCandidate[] {
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
  throw new Error('The model did not return JSON.');
}

function normaliseCandidate(
  item: z.infer<typeof modelCandidateResponseSchema>['candidates'][number],
  index: number
): MiningCandidate {
  const nuance = item.nuance;
  return {
    id: `candidate-${Date.now()}-${index}-${item.expression}`,
    expression: item.expression,
    reading: item.reading,
    meaning: item.meaning,
    contextMeaning: item.contextMeaning,
    partOfSpeech: item.partOfSpeech,
    ...(nuance ? { nuance } : {}),
    exampleJapanese: item.exampleJapanese,
    exampleEnglish: item.exampleEnglish,
    tags: [...item.tags],
    exportFields: { ...item.exportFields },
    status: 'pending',
  };
}

function normaliseCandidates(value: unknown): readonly MiningCandidate[] {
  const parsed = parseWithSchema(
    modelCandidateResponseSchema,
    value,
    'Model candidate response'
  );
  return parsed.candidates.map(normaliseCandidate);
}

function parseChatResponseText(text: string): ChatResponse {
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
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  throw lastError ?? new Error('The model did not return a chat response.');
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
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

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
      "meaning": "short dictionary meaning",
      "contextMeaning": "meaning in this exact input context",
      "partOfSpeech": "noun/verb/adjective/expression/etc",
      "nuance": "optional usage nuance",
      "exampleJapanese": "short natural sentence using the expression",
      "exampleEnglish": "translation of exampleJapanese",
      "tags": ["short", "topic", "tags"],
      "exportFields": {
        "Configured field name": "field value generated according to that field purpose"
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
): Promise<readonly MiningCandidate[]> {
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
): Promise<readonly MiningCandidate[]> {
  const word = wordText.trim();
  if (!word) return [];
  return retryModelOperation(() => analyseChunk(context, word, options));
}

async function rankCandidatesWithModel(
  assistant: AssistantContext,
  expression: string,
  context: string,
  candidates: readonly MiningCandidate[]
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
    meaning: candidate.meaning,
    partOfSpeech: candidate.partOfSpeech,
    nuance: candidate.nuance,
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
  candidate: MiningCandidate,
  context?: string
): Promise<MiningCandidate> {
  const prompt = `Create one short, natural Japanese example for this exact dictionary sense.
The expression must appear in the Japanese sentence. Do not use a different sense.
Return only JSON: {"japanese":"...","english":"..."}.

Expression: ${candidate.expression}
Reading: ${candidate.reading}
Meaning: ${candidate.meaning}
Part of speech: ${candidate.partOfSpeech}
${context?.trim() ? `Source context: ${context.trim()}` : ''}`;
  const text = await retryModelOperation(() =>
    generateText(assistant, prompt, 0.2)
  );
  const parsed = parseJsonText(text, 'Model example response');
  if (!parsed.success) throw parsed.error;
  const value = parsed.value as { japanese?: unknown; english?: unknown };
  if (typeof value.japanese !== 'string' || typeof value.english !== 'string') {
    throw new Error('The model did not return a valid example.');
  }
  return {
    ...candidate,
    exampleJapanese: value.japanese.trim(),
    exampleEnglish: value.english.trim(),
    exampleSource: 'llm',
  };
}

function chatPrompt(
  context: AssistantContext,
  contexts: readonly (MiningCandidate | SavedWord)[],
  messages: readonly ChatMessage[]
): string {
  const contextJson = contexts.map((item) => ({
    expression: item.expression,
    reading: item.reading,
    meaning: item.meaning,
    contextMeaning: item.contextMeaning,
    partOfSpeech: item.partOfSpeech,
    nuance: item.nuance,
    exampleJapanese: item.exampleJapanese,
    exampleEnglish: item.exampleEnglish,
    tags: item.tags,
    exportFields: item.exportFields,
  }));
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n')
    .slice(-context.options.maxInputChars);
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

Set candidate to null for explanation-only answers. If the user asks to create, correct, or improve a word candidate, set candidate to a complete object with expression, reading, meaning, contextMeaning, partOfSpeech, optional nuance, exampleJapanese, exampleEnglish, tags, and exportFields. Populate required configured export fields exactly. Optional fields may be omitted or set to null or an empty string when they are not useful. Before returning a candidate, verify that its reading covers the complete expression character by character; never return a partial reading (for example, 開発 is かいはつ, not かい). Never omit markdown.`;
}

async function verifyChatCandidate(
  context: AssistantContext,
  candidate: MiningCandidate
): Promise<MiningCandidate> {
  const responseText = await generateText(
    context,
    `You are independently validating a Japanese vocabulary record.

Check every field for factual consistency. In particular, verify that the kana reading corresponds to the complete expression, not only its first kanji. Correct any error you find. Preserve configured export fields and return exactly one complete candidate.

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Candidate:
${JSON.stringify(candidate, null, 2)}

Return only valid JSON with this shape:
{ "candidates": [{ "expression": "...", "reading": "...", "meaning": "...", "contextMeaning": "...", "partOfSpeech": "...", "nuance": "optional", "exampleJapanese": "...", "exampleEnglish": "...", "tags": [], "exportFields": {} }] }`
  );
  const verified = extractJson(responseText)[0];
  if (!verified)
    throw new Error('The model did not return a verified candidate.');
  return verified;
}

async function generateChatResponse(
  context: AssistantContext,
  contexts: readonly (MiningCandidate | SavedWord)[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions
): Promise<ChatResponse> {
  const responseText = await generateText(
    context,
    chatPrompt(context, contexts, messages),
    options.temperature ?? 0.3
  );
  return parseChatResponseText(responseText);
}

async function chatWithModel(
  context: AssistantContext,
  contexts: readonly (MiningCandidate | SavedWord)[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions = {}
): Promise<ChatResponse> {
  if (!messages.length) throw new Error('A chat message is required.');
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

export class AssistantService implements VocabularyModel, ConversationService {
  private readonly context: AssistantContext;

  constructor(model: ModelService, options: AssistantOptions) {
    this.context = { model, options };
  }

  public rank(
    expression: string,
    context: string,
    candidates: readonly MiningCandidate[]
  ): Promise<readonly string[]> {
    return rankCandidatesWithModel(
      this.context,
      expression,
      context,
      candidates
    );
  }

  public define(
    expression: string,
    context?: string
  ): Promise<readonly MiningCandidate[]> {
    return analyseWithModel(this.context, expression, {
      ...(context ? { contextText: context } : {}),
    });
  }

  public addExample(
    candidate: MiningCandidate,
    context?: string
  ): Promise<MiningCandidate> {
    return addExampleWithModel(this.context, candidate, context);
  }

  public chat(
    contexts: readonly (MiningCandidate | SavedWord)[],
    messages: readonly ChatMessage[],
    options?: ChatGenerationOptions
  ): Promise<ChatResponse> {
    return chatWithModel(this.context, contexts, messages, options);
  }
}
