import { describe, expect, it } from '@jest/globals';
import { Assistant } from '@/wakaru/assistant.js';
import { Wakaru } from '@/wakaru/wakaru.js';
import { JapaneseVocabulary } from '@/wakaru/vocabulary.js';
import { WakaruLLMUnavailableError } from '@/wakaru/errors.js';

describe('Wakaru', () => {
  it('exposes Japanese vocabulary analysis through the app object', async () => {
    const assistant = new Assistant(
      {
        checkHealth: () => Promise.resolve(true),
        complete: () => Promise.resolve('{}'),
      },
      { fields: [] }
    );
    const vocabulary = new JapaneseVocabulary(
      { tokenise: () => Promise.resolve([]) },
      { lookup: () => [] },
      {
        define: () => Promise.resolve([]),
        rank: () => Promise.resolve([]),
        addExample: (candidate) => Promise.resolve(candidate),
      }
    );
    const wakaru = new Wakaru(vocabulary, assistant);

    const result = await wakaru.analyseVocabulary({ expression: '語' });

    expect(result.source).toBe('llm');
  });

  it('exposes model availability and short-circuits model-only features', async () => {
    const wakaru = new Wakaru(
      new JapaneseVocabulary(
        { tokenise: () => Promise.resolve([]) },
        { lookup: () => [] },
        {
          define: () => Promise.resolve([]),
          rank: () => Promise.resolve([]),
          addExample: (candidate) => Promise.resolve(candidate),
        }
      ),
      new Assistant(
        {
          checkHealth: () => Promise.resolve(false),
          complete: () => Promise.resolve('{}'),
        },
        { fields: [] }
      )
    );

    expect(wakaru.llmAvailable).toBe(false);
    await expect(wakaru.checkHealth()).resolves.toBe(false);
    await expect(
      wakaru.chat([], [{ role: 'user', content: 'hello' }])
    ).rejects.toBeInstanceOf(WakaruLLMUnavailableError);
  });
});
