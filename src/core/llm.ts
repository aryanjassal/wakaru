import type { z } from 'zod';
import type { MiningCandidate, WakaruConfig } from './types.js';

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { configDir } from './config.js';
import {
  JsonValidationError,
  modelCandidateResponseSchema,
  ollamaGenerateResponseSchema,
  parseJsonText,
  parseWithSchema,
} from './schemas.js';

const OLLAMA_FAILURE_LOG = 'ollama-failures.jsonl';

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
    .map((field) => `- ${field.name}: ${field.purpose}`)
    .join('\n');
  const context = options.contextText?.trim();

  return `You are helping a Japanese learner mine words for Anki.

Task:
Analyze the pasted Japanese word or phrase. Return the likely meanings for this exact word. If the meaning is ambiguous and a context sentence is provided, use that context to choose the correct sense and card content. If no context is provided and the word is ambiguous, include the uncertainty in the meaning or nuance fields.

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

Return one to three candidates only when the word genuinely has multiple likely meanings. Populate every configured Anki field name exactly as listed. Do not tokenize the context sentence. Do not discover extra vocabulary from raw text. Do not include explanations outside JSON.`;
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
  return analyzeChunk(config, word, options);
}
