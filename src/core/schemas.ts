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

const generatedExportFields = z
  .record(
    nonEmptyString,
    z.preprocess((value) => (value == null ? '' : value), z.string())
  )
  .default({})
  .transform((fields): Record<string, string> => ({ ...fields }));

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
        definition: z
          .discriminatedUnion('kind', [
            z
              .object({
                kind: z.literal('dictionary'),
                dictionary: nonEmptyString,
                entryId: nonEmptyString,
                senseId: nonEmptyString,
              })
              .strict(),
            z.object({ kind: z.literal('llm') }).strict(),
            z.object({ kind: z.literal('manual') }).strict(),
          ])
          .optional(),
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
