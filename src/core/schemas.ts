import type { MiningCandidate, SavedWord, WakaruConfig } from './types.js';

import { z } from 'zod/v4';
import { parseFormattedText } from './formatting.js';

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
export const formattedTextSchema = nonEmptyString.superRefine(
  (value, context) => {
    try {
      parseFormattedText(value);
    } catch (error) {
      context.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : String(error),
        input: value,
      });
    }
  }
);

const generatedAnkiFieldValue = z.preprocess(
  (value) => (typeof value === 'string' && !value.trim() ? null : value),
  formattedTextSchema.nullable()
);

const generatedAnkiFields = z
  .record(z.string(), generatedAnkiFieldValue)
  .default({})
  .transform(
    (fields): Record<string, string> =>
      Object.fromEntries(
        Object.entries(fields).filter((entry): entry is [string, string] =>
          Boolean(entry[0].trim() && entry[1]?.trim())
        )
      )
  );

export const DEFAULT_ANKI_FORMATTING = {
  boldTemplate: '<strong>{{text}}</strong>',
  italicTemplate: '<em>{{text}}</em>',
  underlineTemplate: '<u>{{text}}</u>',
  readingTemplate: '<ruby>{{expression}}<rt>{{reading}}</rt></ruby>',
  lineBreak: '<br>',
} as const;

const formattingTemplate = z.string().min(1, 'must not be empty');
const ankiFormattingSchema = z
  .object({
    boldTemplate: formattingTemplate.optional(),
    italicTemplate: formattingTemplate.optional(),
    underlineTemplate: formattingTemplate.optional(),
    readingTemplate: formattingTemplate.optional(),
    lineBreak: formattingTemplate.optional(),
  })
  .strict()
  .transform((formatting) => ({
    boldTemplate:
      formatting.boldTemplate ?? DEFAULT_ANKI_FORMATTING.boldTemplate,
    italicTemplate:
      formatting.italicTemplate ?? DEFAULT_ANKI_FORMATTING.italicTemplate,
    underlineTemplate:
      formatting.underlineTemplate ?? DEFAULT_ANKI_FORMATTING.underlineTemplate,
    readingTemplate:
      formatting.readingTemplate ?? DEFAULT_ANKI_FORMATTING.readingTemplate,
    lineBreak: formatting.lineBreak ?? DEFAULT_ANKI_FORMATTING.lineBreak,
  }))
  .superRefine((formatting, context) => {
    const required = [
      ['boldTemplate', formatting.boldTemplate, ['{{text}}']],
      ['italicTemplate', formatting.italicTemplate, ['{{text}}']],
      ['underlineTemplate', formatting.underlineTemplate, ['{{text}}']],
      [
        'readingTemplate',
        formatting.readingTemplate,
        ['{{expression}}', '{{reading}}'],
      ],
    ] as const;
    for (const [path, template, placeholders] of required) {
      for (const placeholder of placeholders) {
        if (template.includes(placeholder)) continue;
        context.addIssue({
          code: 'custom',
          path: [path],
          message: `must include ${placeholder}`,
          input: formatting,
        });
      }
    }
  });

export const DEFAULT_ANKI_FIELDS = [
  {
    name: 'Front',
    purpose:
      'Recognition card front. Show the target expression prominently with its reading and include the source Japanese sentence.',
  },
  {
    name: 'Back',
    purpose:
      'Recognition card back. Include reading, meaning, part of speech, the Japanese sentence, and English translation.',
  },
  {
    name: 'Tags',
    purpose:
      'Space-separated Anki tags. Include wakaru, part of speech, and concise topic tags.',
  },
] as const;

export const DEFAULT_WAKARU_CONFIG: WakaruConfig = {
  llm: {
    provider: 'ollama',
    model: 'qwen3.5:9b',
    apiBase: 'http://localhost:11434',
    maxInputChars: 4096,
  },
  storage: {
    wordsDir: '~/.config/wakaru/words',
  },
  theme: {
    name: 'night',
  },
  anki: {
    fields: [...DEFAULT_ANKI_FIELDS],
    formatting: { ...DEFAULT_ANKI_FORMATTING },
  },
};

const ankiFieldConfigSchema = z
  .object({
    name: nonEmptyString,
    purpose: nonEmptyString,
    optional: z.boolean().optional(),
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
        formatting: ankiFormattingSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .transform((config) => ({
    llm: {
      provider: 'ollama' as const,
      model: config.llm?.model ?? DEFAULT_WAKARU_CONFIG.llm.model,
      apiBase: (
        config.llm?.apiBase ?? DEFAULT_WAKARU_CONFIG.llm.apiBase
      ).replace(/\/+$/, ''),
      maxInputChars:
        config.llm?.maxInputChars ?? DEFAULT_WAKARU_CONFIG.llm.maxInputChars,
    },
    storage: {
      wordsDir:
        config.storage?.wordsDir ?? DEFAULT_WAKARU_CONFIG.storage.wordsDir,
    },
    theme: {
      name: config.theme?.name ?? DEFAULT_WAKARU_CONFIG.theme.name,
    },
    anki: {
      fields: config.anki?.fields ?? [...DEFAULT_WAKARU_CONFIG.anki.fields],
      formatting: config.anki?.formatting ?? {
        ...DEFAULT_WAKARU_CONFIG.anki.formatting,
      },
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

export const modelChatResponseSchema = z.object({
  markdown: nonEmptyString,
  candidate: miningCandidateModelSchema.nullable().optional(),
});

export const miningCandidateSchema = z
  .preprocess(
    aliasCandidateFields,
    rawCandidateSchema.extend({
      id: nonEmptyString,
      status: z.enum(['pending', 'added']),
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
