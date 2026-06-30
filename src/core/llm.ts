import type { z } from 'zod';
import type {
  ChatMessage,
  ChatGenerationOptions,
  ChatResponse,
  MiningCandidate,
  SavedWord,
  WakaruConfig,
} from './types.js';

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { configDir } from './config.js';
import {
  JsonValidationError,
  modelChatResponseSchema,
  modelCandidateResponseSchema,
  ollamaGenerateResponseSchema,
  parseJsonText,
  parseWithSchema,
} from './schemas.js';

const OLLAMA_FAILURE_LOG = 'ollama-failures.jsonl';
const MODEL_ATTEMPT_COUNT = 3;
const FORMATTING_CONTRACT = `Formatting for generated Anki field values:
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
  const parsed = parseJsonText(trimmed, 'Ollama candidate response');
  if (parsed.success) return normaliseCandidates(parsed.value);

  // Method 2: Try extracting markdown fenced blocks
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const fencedParsed = parseJsonText(fenced, 'Ollama candidate response');
    if (fencedParsed.success) return normaliseCandidates(fencedParsed.value);
    throw fencedParsed.error;
  }

  // Method 3: find first `{` and last `}` and extract JSON from within
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = parseJsonText(
      trimmed.slice(start, end + 1),
      'Ollama candidate response'
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
    ankiFields: { ...item.ankiFields },
    status: 'pending',
  };
}

function normaliseCandidates(value: unknown): readonly MiningCandidate[] {
  const parsed = parseWithSchema(
    modelCandidateResponseSchema,
    value,
    'Ollama candidate response'
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
    const parsed = parseJsonText(candidateText, 'Ollama chat response');
    if (!parsed.success) {
      lastError = parsed.error;
      continue;
    }
    try {
      const response = parseWithSchema(
        modelChatResponseSchema,
        parsed.value,
        'Ollama chat response'
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

function serialiseError(error: unknown): Record<string, unknown> {
  if (error instanceof JsonValidationError) {
    return {
      name: error.name,
      message: error.message,
      issues: [...error.issues],
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

async function logOllamaFailure(
  config: WakaruConfig,
  wordText: string,
  options: AnalyzeInputOptions,
  responseText: string,
  error: unknown
): Promise<void> {
  const path = join(configDir(), OLLAMA_FAILURE_LOG);
  const entry = {
    timestamp: new Date().toISOString(),
    model: config.llm.model,
    apiBase: config.llm.apiBase,
    wordText,
    contextText: options.contextText ?? '',
    responseText,
    error: serialiseError(error),
  };
  try {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch {
    // Logging must never hide the original model/parsing error.
  }
}

export type AnalyzeInputOptions = Readonly<{
  contextText?: string;
}>;

function promptFor(
  config: WakaruConfig,
  wordText: string,
  options: AnalyzeInputOptions
): string {
  const ankiFields = config.anki.fields
    .map(
      (field) =>
        `- ${field.name}${field.optional ? ' (optional)' : ' (required)'}: ${field.purpose}`
    )
    .join('\n');
  const context = options.contextText?.trim();

  return `You are helping a Japanese learner mine words for Anki.

Task:
Analyze the pasted Japanese word or phrase. Return the likely meanings for this exact word. If the meaning is ambiguous and a context sentence is provided, use that context to choose the correct sense and card content. If no context is provided and the word is ambiguous, include the uncertainty in the meaning or nuance fields.

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Word or phrase:
${wordText}

${context ? `Context sentence:\n${context}\n` : ''}
Anki note fields to populate:
${ankiFields}

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
      "tags": ["short", "anki", "tags"],
      "ankiFields": {
        "Configured field name": "field value generated according to that field purpose"
      }
    }
  ]
}

Return one to three candidates only when the word genuinely has multiple likely meanings. Populate every required configured Anki field name exactly as listed. Optional fields may be omitted or set to null or an empty string when they do not add useful information. Do not tokenize the context sentence. Do not discover extra vocabulary from raw text. Do not include explanations outside JSON.`;
}

async function analyzeChunk(
  config: WakaruConfig,
  wordText: string,
  options: AnalyzeInputOptions
): Promise<readonly MiningCandidate[]> {
  const response = await fetch(`${config.llm.apiBase}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      prompt: promptFor(config, wordText, options),
      stream: false,
      think: false,
      format: 'json',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}. Is it running at ${config.llm.apiBase}?`
    );
  }

  const responseText = await response.text();
  const responseJson = parseJsonText(responseText, 'Ollama generate response');
  if (!responseJson.success) {
    await logOllamaFailure(
      config,
      wordText,
      options,
      responseText,
      responseJson.error
    );
    throw responseJson.error;
  }

  let payload: z.infer<typeof ollamaGenerateResponseSchema>;
  try {
    payload = parseWithSchema(
      ollamaGenerateResponseSchema,
      responseJson.value,
      'Ollama generate response'
    );
  } catch (error) {
    await logOllamaFailure(config, wordText, options, responseText, error);
    throw error;
  }
  if (payload.error) throw new Error(payload.error);
  if (!payload.response) throw new Error('Ollama returned an empty response.');
  try {
    return extractJson(payload.response);
  } catch (error) {
    await logOllamaFailure(config, wordText, options, payload.response, error);
    throw error;
  }
}

export async function analyzeWithOllama(
  config: WakaruConfig,
  wordText: string,
  options: AnalyzeInputOptions = {}
): Promise<readonly MiningCandidate[]> {
  const word = wordText.trim();
  if (!word) return [];
  return retryModelOperation(() => analyzeChunk(config, word, options));
}

function chatPrompt(
  config: WakaruConfig,
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
    ankiFields: item.ankiFields,
  }));
  const transcript = messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n')
    .slice(-config.llm.maxInputChars);
  const fields = config.anki.fields
    .map(
      (field) =>
        `- ${field.name}${field.optional ? ' (optional)' : ' (required)'}: ${field.purpose}`
    )
    .join('\n');

  return `You are a Japanese-learning assistant. Answer the user's question about the attached vocabulary context. The user may ask for clarification or request an improved candidate.

Attached vocabulary context:
${JSON.stringify(contextJson, null, 2)}

Conversation:
${transcript}

Configured Anki fields:
${fields}

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Return only valid JSON with this shape:
{
  "markdown": "A useful answer formatted as Markdown",
  "candidate": null
}

Set candidate to null for explanation-only answers. If the user asks to create, correct, or improve a word candidate, set candidate to a complete object with expression, reading, meaning, contextMeaning, partOfSpeech, optional nuance, exampleJapanese, exampleEnglish, tags, and ankiFields. Populate required configured Anki fields exactly. Optional fields may be omitted or set to null or an empty string when they are not useful. Before returning a candidate, verify that its reading covers the complete expression character by character; never return a partial reading (for example, 開発 is かいはつ, not かい). Never omit markdown.`;
}

async function verifyChatCandidate(
  config: WakaruConfig,
  candidate: MiningCandidate
): Promise<MiningCandidate> {
  const response = await fetch(`${config.llm.apiBase}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      prompt: `You are independently validating a Japanese vocabulary record.

Check every field for factual consistency. In particular, verify that the kana reading corresponds to the complete expression, not only its first kanji. Correct any error you find. Preserve configured Anki fields and return exactly one complete candidate.

${FORMATTING_CONTRACT}
The markdown answer may otherwise use ordinary Markdown. Use {expression|reading} as its only reading syntax. NEVER output HTML.

Candidate:
${JSON.stringify(candidate, null, 2)}

Return only valid JSON with this shape:
{ "candidates": [{ "expression": "...", "reading": "...", "meaning": "...", "contextMeaning": "...", "partOfSpeech": "...", "nuance": "optional", "exampleJapanese": "...", "exampleEnglish": "...", "tags": [], "ankiFields": {} }] }`,
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0 },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Ollama candidate verification returned HTTP ${response.status}.`
    );
  }
  const responseJson = parseJsonText(
    await response.text(),
    'Ollama candidate verification response'
  );
  if (!responseJson.success) throw responseJson.error;
  const payload = parseWithSchema(
    ollamaGenerateResponseSchema,
    responseJson.value,
    'Ollama candidate verification response'
  );
  if (payload.error) throw new Error(payload.error);
  if (!payload.response)
    throw new Error('Ollama returned an empty verification response.');
  const verified = extractJson(payload.response)[0];
  if (!verified) throw new Error('Ollama did not return a verified candidate.');
  return verified;
}

async function generateChatResponse(
  config: WakaruConfig,
  contexts: readonly (MiningCandidate | SavedWord)[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions
): Promise<ChatResponse> {
  const response = await fetch(`${config.llm.apiBase}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      prompt: chatPrompt(config, contexts, messages),
      stream: false,
      think: false,
      format: 'json',
      options: {
        temperature: options.temperature ?? 0.3,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}. Is it running at ${config.llm.apiBase}?`
    );
  }

  const responseText = await response.text();
  const responseJson = parseJsonText(responseText, 'Ollama generate response');
  if (!responseJson.success) throw responseJson.error;
  const payload = parseWithSchema(
    ollamaGenerateResponseSchema,
    responseJson.value,
    'Ollama generate response'
  );
  if (payload.error) throw new Error(payload.error);
  if (!payload.response) throw new Error('Ollama returned an empty response.');
  return parseChatResponseText(payload.response);
}

export async function chatWithOllama(
  config: WakaruConfig,
  contexts: readonly (MiningCandidate | SavedWord)[],
  messages: readonly ChatMessage[],
  options: ChatGenerationOptions = {}
): Promise<ChatResponse> {
  if (!messages.length) throw new Error('A chat message is required.');
  const chatResponse = await retryModelOperation(() =>
    generateChatResponse(config, contexts, messages, options)
  );
  const candidate = chatResponse.candidate;
  if (!candidate) return chatResponse;
  return {
    ...chatResponse,
    candidate: await retryModelOperation(() =>
      verifyChatCandidate(config, candidate)
    ),
  };
}
