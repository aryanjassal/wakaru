import { describe, expect, it } from '@jest/globals';
import { createCustomWakaru } from '@/client/create.js';
import { WakaruLLMUnavailableError } from '@/core/errors.js';
import type { VocabularyInput } from '@/core/services/vocabulary.js';

type CustomInput = VocabularyInput & Readonly<{ dictionary: string }>;

describe('Wakaru', () => {
  it('accepts client-supplied services and custom vocabulary input', async () => {
    const wakaru = createCustomWakaru<CustomInput>({
      vocabulary: {
        analyse: (input) =>
          Promise.resolve({
            tokens: [],
            candidates: [],
            source: input.dictionary === 'custom' ? 'dictionary' : 'llm',
          }),
        prepare: (candidate) => Promise.resolve(candidate),
      },
      conversation: {
        availability: 'available',
        checkHealth: () => Promise.resolve(true),
        chat: () => Promise.resolve({ markdown: 'ok' }),
      },
    });

    const result = await wakaru.analyseVocabulary({
      expression: '語',
      dictionary: 'custom',
    });

    expect(result.source).toBe('dictionary');
  });

  it('exposes model availability and short-circuits model-only features', async () => {
    const wakaru = createCustomWakaru({
      vocabulary: {
        analyse: () =>
          Promise.resolve({ tokens: [], candidates: [], source: 'dictionary' }),
        prepare: (candidate) => Promise.resolve(candidate),
      },
      conversation: {
        availability: 'unavailable',
        checkHealth: () => Promise.resolve(false),
        chat: () => Promise.reject(new WakaruLLMUnavailableError()),
      },
    });

    expect(wakaru.llmAvailable).toBe(false);
    await expect(wakaru.checkHealth()).resolves.toBe(false);
    await expect(
      wakaru.chat([], [{ role: 'user', content: 'hello' }])
    ).rejects.toBeInstanceOf(WakaruLLMUnavailableError);
  });
});
