import { z } from 'zod/v4';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');

export const INTERNAL_FIELD_TYPES = [
  'id',
  'expression',
  'reading',
  'meaning',
  'contextMeaning',
  'partOfSpeech',
  'exampleJapanese',
  'exampleEnglish',
  'tags',
  'sourceText',
  'createdAt',
] as const;

const exportFieldBaseSchema = z
  .object({
    key: nonEmptyString,
    optional: z.boolean().optional(),
  })
  .strict();

const exportFieldSchema = z.union([
  exportFieldBaseSchema.extend({
    inherit: z.enum(INTERNAL_FIELD_TYPES),
  }),
  exportFieldBaseSchema.extend({ modelPrompt: nonEmptyString }),
]);

export const modelConfigSchema = z
  .object({
    name: nonEmptyString,
    apiBase: nonEmptyString.optional(),
    apiKey: z.string().optional().nullable(),
    contextWindow: z.number().int().positive().optional(),
  })
  .strict();

export type ModelConfig = z.infer<typeof modelConfigSchema>;

export const exportConfigSchema = z
  .object({
    fields: exportFieldSchema.array().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();
    value.fields.forEach((field, index) => {
      if (!seen.has(field.key)) {
        seen.add(field.key);
        return;
      }
      context.addIssue({
        code: 'custom',
        path: ['fields', index, 'key'],
        message: 'field keys must be unique',
        input: field.key,
      });
    });
  });

export type ExportConfig = z.infer<typeof exportConfigSchema>;

export const clientConfigSchema = z
  .object({
    model: modelConfigSchema,
    export: exportConfigSchema,
  })
  .strict();

export type ClientConfig = z.infer<typeof clientConfigSchema>;
