import type { MiningCandidate, SavedWord, WakaruConfig } from '../types.js';

import { z } from 'zod/v4';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');
const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .optional();
const positiveInt = z.number().int().positive();
const hexColor = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, 'must be a 6-digit hex color like #8bcf8b');

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
        name: z.enum(['night', 'day', 'custom']).optional(),
        customPath: nonEmptyString.optional(),
      })
      .strict()
      .optional(),
    anki: z
      .object({
        fields: z.array(ankiFieldConfigSchema).min(1).optional(),
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
      customPath: config.theme?.customPath ?? '~/.config/wakaru/theme.json',
    },
    anki: {
      fields: config.anki?.fields ?? [...DEFAULT_ANKI_FIELDS],
    },
  })) satisfies z.ZodType<WakaruConfig>;

export const customThemeSchema = z
  .object({
    label: nonEmptyString.default('Custom'),
    colors: z
      .object({
        base: hexColor.optional(),
        panel: hexColor.optional(),
        panelInset: hexColor.optional(),
        panelElevated: hexColor.optional(),
        text: hexColor.optional(),
        muted: hexColor.optional(),
        dim: hexColor.optional(),
        inverse: hexColor.optional(),
        accent: hexColor.optional(),
        info: hexColor.optional(),
        success: hexColor.optional(),
        warning: hexColor.optional(),
        danger: hexColor.optional(),
        border: hexColor.optional(),
        borderMuted: hexColor.optional(),
        focus: hexColor.optional(),
        focusBg: hexColor.optional(),
        selected: hexColor.optional(),
        selectedText: hexColor.optional(),
      })
      .strict()
      .default({}),
  })
  .strict();

export const miningCandidateModelSchema = z
  .object({
    expression: nonEmptyString,
    reading: nonEmptyString,
    meaning: nonEmptyString,
    contextMeaning: nonEmptyString,
    partOfSpeech: nonEmptyString,
    pitchAccent: optionalNonEmptyString,
    nuance: optionalNonEmptyString,
    exampleJapanese: nonEmptyString,
    exampleEnglish: nonEmptyString,
    tags: z.array(nonEmptyString).default([]),
    ankiFields: z.record(z.string(), z.string()).default({}),
  })
  .strict();

export const modelCandidateResponseSchema = z
  .object({
    candidates: z
      .array(miningCandidateModelSchema)
      .min(1, 'must include at least one candidate'),
  })
  .strict();

export const miningCandidateSchema = miningCandidateModelSchema
  .extend({
    id: nonEmptyString,
    status: z.enum(['pending', 'added', 'skipped']),
  })
  .strict() satisfies z.ZodType<MiningCandidate>;

export const savedWordSchema = miningCandidateModelSchema
  .extend({
    id: nonEmptyString,
    sourceText: z.string(),
    createdAt: nonEmptyString,
  })
  .strict() satisfies z.ZodType<SavedWord>;

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
