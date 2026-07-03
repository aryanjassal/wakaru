import type { MiningCandidate, SavedWord } from './types.js';

import { z } from 'zod/v4';
import { parseFormattedText } from './formatting.js';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');
const optionalNonEmptyString = z
  .string()
  .trim()
  .min(1, 'must not be empty')
  .optional();
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

const generatedExportFieldValue = z.preprocess(
  (value) => (typeof value === 'string' && !value.trim() ? null : value),
  formattedTextSchema.nullable()
);

const generatedExportFields = z
  .record(z.string(), generatedExportFieldValue)
  .default({})
  .transform(
    (fields): Record<string, string> =>
      Object.fromEntries(
        Object.entries(fields).filter((entry): entry is [string, string] =>
          Boolean(entry[0].trim() && entry[1]?.trim())
        )
      )
  );

export const DEFAULT_HTML_FORMATTING = {
  boldTemplate: '<strong>{{text}}</strong>',
  italicTemplate: '<em>{{text}}</em>',
  underlineTemplate: '<u>{{text}}</u>',
  readingTemplate: '<ruby>{{expression}}<rt>{{reading}}</rt></ruby>',
  lineBreak: '<br>',
} as const;

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
  exportFields: generatedExportFields,
  definitionSource: nonEmptyString.optional(),
  exampleSource: nonEmptyString.optional(),
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
    exportFields: item.exportFields ?? item.export_fields ?? item.fields,
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
