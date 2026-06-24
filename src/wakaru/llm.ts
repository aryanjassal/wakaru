import type { MiningCandidate, WakaruConfig } from '../types.js';
import type { z } from 'zod';
import {
  modelCandidateResponseSchema,
  ollamaGenerateResponseSchema,
  parseJsonText,
  parseWithSchema,
} from './schemas.js';

function extractJson(text: string): readonly MiningCandidate[] {
  const trimmed = text.trim();
  const parsed = parseJsonText(trimmed, 'Ollama candidate response');
  if (parsed.success) return normalizeCandidates(parsed.value);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const fencedParsed = parseJsonText(fenced, 'Ollama candidate response');
    if (fencedParsed.success) return normalizeCandidates(fencedParsed.value);
    throw fencedParsed.error;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const sliced = parseJsonText(
      trimmed.slice(start, end + 1),
      'Ollama candidate response'
    );
    if (sliced.success) return normalizeCandidates(sliced.value);
    throw sliced.error;
  }

  throw new Error('The model did not return JSON.');
}

function normalizeCandidate(
  item: z.infer<typeof modelCandidateResponseSchema>['candidates'][number],
  index: number
): MiningCandidate {
  const pitchAccent = item.pitchAccent;
  const nuance = item.nuance;
  return {
    id: `candidate-${Date.now()}-${index}-${item.expression}`,
    expression: item.expression,
    reading: item.reading,
    meaning: item.meaning,
    contextMeaning: item.contextMeaning,
    partOfSpeech: item.partOfSpeech,
    ...(pitchAccent ? { pitchAccent } : {}),
    ...(nuance ? { nuance } : {}),
    exampleJapanese: item.exampleJapanese,
    exampleEnglish: item.exampleEnglish,
    tags: [...item.tags],
    ankiFields: { ...item.ankiFields },
    status: 'pending',
  };
}

function normalizeCandidates(value: unknown): readonly MiningCandidate[] {
  const parsed = parseWithSchema(
    modelCandidateResponseSchema,
    value,
    'Ollama candidate response'
  );
  return parsed.candidates.map(normalizeCandidate);
}

function splitInput(inputText: string, maxChars: number): readonly string[] {
  const normalized = inputText.trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let current = '';
  for (const block of normalized.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      for (let index = 0; index < trimmed.length; index += maxChars) {
        chunks.push(trimmed.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current}\n\n${trimmed}` : trimmed;
    if (next.length > maxChars) {
      chunks.push(current);
      current = trimmed;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function promptFor(config: WakaruConfig, inputText: string): string {
  const ankiFields = config.anki.fields
    .map((field) => `- ${field.name}: ${field.purpose}`)
    .join('\n');

  return `You are helping a Japanese learner mine words for Anki.

Input text:
${inputText}

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
      "pitchAccent": "optional accent note if known",
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

Choose useful unknown vocabulary and fixed expressions. Prefer 3 to 8 candidates. Populate every configured Anki field name exactly as listed. Do not include explanations outside JSON.`;
}

async function analyzeChunk(
  config: WakaruConfig,
  inputText: string
): Promise<readonly MiningCandidate[]> {
  const response = await fetch(`${config.llm.apiBase}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      prompt: promptFor(config, inputText),
      stream: false,
      format: 'json',
      options: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama returned HTTP ${response.status}. Is it running at ${config.llm.apiBase}?`
    );
  }

  const payload = parseWithSchema(
    ollamaGenerateResponseSchema,
    await response.json(),
    'Ollama generate response'
  );
  if (payload.error) throw new Error(payload.error);
  if (!payload.response) throw new Error('Ollama returned an empty response.');
  return extractJson(payload.response);
}

export async function analyzeWithOllama(
  config: WakaruConfig,
  inputText: string
): Promise<readonly MiningCandidate[]> {
  const chunks = splitInput(inputText, config.llm.maxInputChars);
  const candidates: MiningCandidate[] = [];
  for (const chunk of chunks) {
    candidates.push(...(await analyzeChunk(config, chunk)));
  }
  return candidates;
}
