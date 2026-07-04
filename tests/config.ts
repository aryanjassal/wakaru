import type { ClientConfig } from '@/client/schema/config.js';
import type { AssistantCandidate } from '@/core/types.js';
import { clientConfigSchema } from '@/client/schema/config.js';
import { miningCandidateSchema } from '@/core/schemas.js';
import { parseWithSchema } from '@/core/validation/json.js';

type TestConfigOverrides = Readonly<{
  model?: Partial<ClientConfig['model']>;
  export?: Partial<ClientConfig['export']>;
}>;

export function getTestConfig(
  overrides: TestConfigOverrides = {}
): ClientConfig {
  return parseWithSchema(clientConfigSchema, {
    model: {
      name: 'qwen2.5:7b',
      apiBase: 'http://localhost:11434',
      contextWindow: 32_768,
      ...overrides.model,
    },
    export: {
      fields: [
        { key: 'Front', inherit: 'expression' },
        { key: 'Back', modelPrompt: 'back field' },
      ],
      ...overrides.export,
    },
  });
}

export function createTestCandidate(
  overrides: Partial<AssistantCandidate> = {}
): AssistantCandidate {
  return parseWithSchema(miningCandidateSchema, {
    id: 'c-1',
    expression: '配慮',
    reading: 'はいりょ',
    meanings: ['consideration'],
    details: {
      contextMeaning: 'careful thought for someone',
      partOfSpeech: ['noun'],
      nuance: 'Often used for considerate handling of people or situations.',
      example: {
        japanese: '相手への配慮が必要だ。',
        english: 'Consideration for the other person is necessary.',
      },
    },
    extension: { tags: ['noun', 'mined'], exportFields: {} },
    ...overrides,
  });
}
