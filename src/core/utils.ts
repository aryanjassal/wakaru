import type { MiningCandidate } from './types';

import { z } from 'zod/v4';
import { miningCandidateSchema } from './schemas';

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
