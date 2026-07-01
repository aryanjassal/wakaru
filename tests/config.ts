import type { MiningCandidate, WakaruConfig } from '@/core/types.js';
import {
  miningCandidateSchema,
  parseWithSchema,
  wakaruConfigSchema,
} from '@/core/schemas.js';

type TestConfigOverrides = Readonly<{
  llm?: Partial<WakaruConfig['llm']>;
  storage?: Partial<WakaruConfig['storage']>;
  anki?: Partial<WakaruConfig['anki']>;
}>;

export function getTestConfig(
  overrides: TestConfigOverrides = {}
): WakaruConfig {
  return parseWithSchema(wakaruConfigSchema, {
    llm: {
      model: 'qwen2.5:7b',
      apiBase: 'http://localhost:11434',
      ...overrides.llm,
    },
    storage: {
      wordsDir: '/tmp/wakaru-test',
      ...overrides.storage,
    },
    anki: {
      fields: [
        { name: 'Front', purpose: 'front field' },
        { name: 'Back', purpose: 'back field' },
      ],
      ...overrides.anki,
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
