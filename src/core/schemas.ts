import type { MiningCandidate, SavedWord, WakaruConfig } from './types.js';

import { z } from 'zod/v4';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');
const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .optional();
const positiveInt = z.number().int().positive();
const stringList = z
  .array(nonEmptyString)
  .default([])
  .catch([])
  .transform((items) => [...new Set(items)]);
const generatedAnkiFields = z
  .record(z.string(), z.unknown())
  .default({})
  .catch({})
  .transform((fields): Record<string, string> => {
    const entries = Object.entries(fields)
      .filter(([key, value]) => key.trim() && value != null)
      .map(([key, value]) => [key, String(value).trim()] as const)
      .filter(([, value]) => value);
    return Object.fromEntries(entries);
  });

export const DEFAULT_ANKI_FIELDS = [
  {
    name: 'Front',
    purpose:
      'Recognition card front. HTML is allowed. Show the target expression prominently and include the source Japanese sentence.',
  },
  {
    name: 'Back',
    purpose:
      'Recognition card back. HTML is allowed. Include reading, meaning, part of speech, the Japanese sentence, and English translation.',
  },
  {
    name: 'Tags',
    purpose:
      'Space-separated Anki tags. Include wakaru, part of speech, and concise topic tags.',
  },
] as const;

const ankiFieldConfigSchema = z
  .object({
    name: nonEmptyString,
    purpose: nonEmptyString,
  })
  .strict();

export const wakaruConfigSchema = z
  .object({
    llm: z
      .object({
        provider: z.literal('ollama').optional(),
        model: nonEmptyString.optional(),
        apiBase: nonEmptyString.optional(),
        maxInputChars: positiveInt.optional(),
      })
      .strict()
      .optional(),
    storage: z
      .object({
        wordsDir: nonEmptyString.optional(),
      })
      .strict()
      .optional(),
    theme: z
      .object({
        name: z.literal('night').optional(),
      })
      .strict()
      .optional(),
    anki: z
      .object({
        fields: z.array(ankiFieldConfigSchema).min(1).optional(),
      })
      .strict()
      .optional(),
    analysis: z
      .object({
        sentenceModeThreshold: positiveInt.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .transform((config) => ({
    llm: {
      provider: 'ollama' as const,
      model: config.llm?.model ?? 'qwen3.5:9b',
      apiBase: (config.llm?.apiBase ?? 'http://localhost:11434').replace(
        /\/+$/,
        ''
      ),
      maxInputChars: config.llm?.maxInputChars ?? 4_000,
    },
    storage: {
      wordsDir: config.storage?.wordsDir ?? '~/.config/wakaru/words',
    },
    theme: {
      name: config.theme?.name ?? 'night',
    },
    anki: {
      fields: config.anki?.fields ?? [...DEFAULT_ANKI_FIELDS],
    },
    analysis: {
      sentenceModeThreshold: config.analysis?.sentenceModeThreshold ?? 80,
    },
  })) satisfies z.ZodType<WakaruConfig>;

const rawCandidateSchema = z.object({
  expression: nonEmptyString,
  reading: nonEmptyString,
  meaning: nonEmptyString,
  contextMeaning: optionalNonEmptyString,
  partOfSpeech: optionalNonEmptyString,
  nuance: optionalNonEmptyString,
  exampleJapanese: optionalNonEmptyString,
  exampleEnglish: optionalNonEmptyString,
  tags: stringList,
  ankiFields: generatedAnkiFields,
});

function aliasCandidateFields(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  const item = value as Record<string, unknown>;
  return {
    ...item,
    expression:
      item.expression ?? item.word ?? item.term ?? item.vocabulary ?? item.text,
    reading: item.reading ?? item.furigana ?? item.kana,
    meaning: item.meaning ?? item.definition ?? item.gloss,
    contextMeaning: item.contextMeaning ?? item.context_meaning,
    partOfSpeech: item.partOfSpeech ?? item.part_of_speech ?? item.pos,
    exampleJapanese:
      item.exampleJapanese ??
      item.example_japanese ??
      item.japaneseExample ??
      item.sentence,
    exampleEnglish:
      item.exampleEnglish ??
      item.example_english ??
      item.englishExample ??
      item.translation,
    ankiFields: item.ankiFields ?? item.anki_fields ?? item.fields,
  };
}

function completeCandidate(candidate: z.infer<typeof rawCandidateSchema>) {
  return {
    ...candidate,
    contextMeaning: candidate.contextMeaning ?? candidate.meaning,
    partOfSpeech: candidate.partOfSpeech ?? 'unknown',
    exampleJapanese: candidate.exampleJapanese ?? candidate.expression,
    exampleEnglish: candidate.exampleEnglish ?? candidate.meaning,
  };
}

export const miningCandidateModelSchema = z
  .preprocess(aliasCandidateFields, rawCandidateSchema)
  .transform(completeCandidate);

export const modelCandidateResponseSchema = z.preprocess(
  (value) => {
    if (Array.isArray(value)) return { candidates: value };
    return value;
  },
  z.object({
    candidates: z
      .array(miningCandidateModelSchema)
      .min(1, 'must include at least one candidate'),
  })
);

export const miningCandidateSchema = z
  .preprocess(
    aliasCandidateFields,
    rawCandidateSchema.extend({
      id: nonEmptyString,
      status: z.enum(['pending', 'added', 'skipped']),
    })
  )
  .transform((candidate) => ({
    ...completeCandidate(candidate),
    id: candidate.id,
    status: candidate.status,
  })) satisfies z.ZodType<MiningCandidate>;

export const savedWordSchema = z
  .preprocess(
    aliasCandidateFields,
    rawCandidateSchema.extend({
      id: nonEmptyString,
      sourceText: z.string(),
      createdAt: nonEmptyString,
    })
  )
  .transform((word) => ({
    ...completeCandidate(word),
    id: word.id,
    sourceText: word.sourceText,
    createdAt: word.createdAt,
  })) satisfies z.ZodType<SavedWord>;

export const savedWordsSchema = z.array(savedWordSchema);

export const ollamaGenerateResponseSchema = z
  .object({
    response: z.string().optional(),
    error: z.string().optional(),
  })
  .loose();

export class JsonValidationError extends Error {
  constructor(
    message: string,
    readonly issues: readonly string[]
  ) {
    super(message);
    this.name = 'JsonValidationError';
  }
}

function issuePath(issue: z.core.$ZodIssue): string {
  return issue.path.length ? issue.path.map(String).join('.') : 'root';
}

export function formatZodIssues(error: z.ZodError): readonly string[] {
  return error.issues.map((issue) => `${issuePath(issue)}: ${issue.message}`);
}

export function toJsonValidationError(
  label: string,
  error: z.ZodError
): JsonValidationError {
  const issues = formatZodIssues(error);
  const preview = issues.slice(0, 5).join('; ');
  const suffix =
    issues.length > 5 ? `; and ${issues.length - 5} more issue(s)` : '';
  return new JsonValidationError(
    `${label} is invalid: ${preview}${suffix}`,
    issues
  );
}

export type JsonParseResult =
  | Readonly<{ success: true; value: unknown }>
  | Readonly<{ success: false; error: JsonValidationError }>;

export function parseJsonText(text: string, label = 'JSON'): JsonParseResult {
  try {
    const value = JSON.parse(text) as unknown;
    return { success: true, value };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: new JsonValidationError(`${label} is not valid JSON: ${message}`, [
        message,
      ]),
    };
  }
}

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
  label = 'JSON'
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw toJsonValidationError(label, result.error);
  }
  return result.data;
}

export function parseCandidates(text: string): readonly MiningCandidate[] {
  const parsed = parseJsonText(text);
  if (parsed.success) {
    return parseWithSchema(z.array(miningCandidateSchema), parsed.value);
  }
  throw parsed.error;
}
