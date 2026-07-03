import type { ClientConfig } from '@/client/schema/config.js';
import type { MiningCandidate } from '@/core/types.js';
import { clientConfigSchema } from '@/client/schema/config.js';
import { miningCandidateSchema } from '@/core/schemas.js';
import { parseWithSchema } from '@/core/utils.js';

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
      maxInputChars: 4096,
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
  overrides: Partial<MiningCandidate> = {}
): MiningCandidate {
  return parseWithSchema(miningCandidateSchema, {
    id: 'c-1',
    expression: '配慮',
    reading: 'はいりょ',
    meaning: 'consideration',
    contextMeaning: 'careful thought for someone',
    partOfSpeech: 'noun',
    nuance: 'Often used for considerate handling of people or situations.',
    exampleJapanese: '相手への配慮が必要だ。',
    exampleEnglish: 'Consideration for the other person is necessary.',
    tags: ['noun', 'mined'],
    status: 'pending',
    ...overrides,
  });
}
