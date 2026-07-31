import type { SavedWord } from '../types.js';

import { z } from 'zod/v4';
import { miningCandidateSchema } from '@/wakaru/schemas.js';

const nonEmptyString = z.string().trim().min(1, 'must not be empty');

export const savedWordSchema = z
  .object({
    id: nonEmptyString,
    candidate: miningCandidateSchema,
    sourceText: z.string(),
    createdAt: nonEmptyString,
  })
  .strict() satisfies z.ZodType<SavedWord>;

export const savedWordsSchema = z.array(savedWordSchema);
