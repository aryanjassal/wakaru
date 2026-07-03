import type {
  AssistantCandidate,
  AssistantCandidateExtension,
  CandidateDetails,
} from './types.js';

import { z } from 'zod/v4';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');
const optionalNonEmptyString = nonEmptyString.optional();
const stringList = z
  .array(nonEmptyString)
  .default([])
  .transform((items) => [...new Set(items)]);

const generatedExportFieldValue = z.preprocess(
  (value) => (typeof value === 'string' && !value.trim() ? null : value),
  nonEmptyString.nullable()
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

export const candidateDetailsSchema = z
  .object({
    contextMeaning: optionalNonEmptyString,
    partOfSpeech: stringList.optional(),
    nuance: optionalNonEmptyString,
    example: z
      .object({
        japanese: nonEmptyString,
        english: optionalNonEmptyString,
      })
      .optional(),
    provenance: z
      .object({
        definition: optionalNonEmptyString,
        example: optionalNonEmptyString,
      })
      .optional(),
  })
  .strict() satisfies z.ZodType<CandidateDetails>;

export const assistantCandidateExtensionSchema = z
  .object({
    tags: stringList,
    exportFields: generatedExportFields,
  })
  .strict() satisfies z.ZodType<AssistantCandidateExtension>;

const modelCandidateSchema = z
  .object({
    expression: nonEmptyString,
    reading: optionalNonEmptyString,
    meanings: z.array(nonEmptyString).min(1),
    details: candidateDetailsSchema.optional(),
    extension: assistantCandidateExtensionSchema.optional(),
  })
  .strict();

export const modelCandidateResponseSchema = z.object({
  candidates: z
    .array(modelCandidateSchema)
    .min(1, 'must include at least one candidate'),
});

export const modelChatResponseSchema = z.object({
  markdown: nonEmptyString,
  candidate: modelCandidateSchema.nullable().optional(),
});

export const miningCandidateSchema = modelCandidateSchema
  .extend({ id: nonEmptyString })
  .strict() satisfies z.ZodType<AssistantCandidate>;
