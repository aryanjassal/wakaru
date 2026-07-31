import { describe, expect, it, jest } from '@jest/globals';
import type { AssistantCandidate } from '@/wakaru/types.js';
import type {
  DictionaryRepository,
  JapaneseTokeniser,
  VocabularyAssistant,
} from '@/wakaru/vocabulary.js';
import { JapaneseVocabulary } from '@/wakaru/vocabulary.js';
import { createTestCandidate } from './config.js';

const tokeniser: JapaneseTokeniser = {
  tokenise: () =>
    Promise.resolve([
      {
        surface: '稼い',
        lemma: '稼ぐ',
        reading: 'カセイ',
        partOfSpeech: ['動詞'],
        unknown: false,
      },
    ]),
};

function assistant(
  overrides: Partial<VocabularyAssistant> = {}
): VocabularyAssistant {
  return {
    rank: () => Promise.resolve([]),
    define: () => Promise.resolve([]),
    addExample: (candidate) => Promise.resolve(candidate),
    ...overrides,
  };
}

describe('JapaneseVocabulary', () => {
  it('uses token lemmas for dictionary lookup', async () => {
    const lookup = jest
      .fn<DictionaryRepository['lookup']>()
      .mockImplementation(() => [
        {
          id: 'jmdict:1:0',
          source: 'jmdict',
          entryId: '1',
          senseId: '0',
          expression: '稼ぐ',
          reading: 'かせぐ',
          meanings: ['to earn'],
          partOfSpeech: ['verb'],
          information: [],
          priority: 3,
        },
      ]);
    const vocabulary = new JapaneseVocabulary(
      tokeniser,
      { lookup },
      assistant()
    );

    const result = await vocabulary.analyse({ expression: '稼いでいる' });

    expect(lookup.mock.calls[0]?.[0]).toContain('稼ぐ');
    expect(result.source).toBe('dictionary');
    expect(result.candidates[0]?.details?.provenance?.definition).toEqual({
      kind: 'dictionary',
      dictionary: 'jmdict',
      entryId: '1',
      senseId: '0',
    });
  });

  it('uses the model only to rank dictionary candidates in context', async () => {
    const lookup: DictionaryRepository['lookup'] = () =>
      ['first', 'second'].map((id, index) => ({
        id,
        source: 'jmdict' as const,
        entryId: '1',
        senseId: String(index),
        expression: '掛ける',
        reading: 'かける',
        meanings: [`meaning ${index}`],
        partOfSpeech: ['verb'],
        information: [],
        priority: 3,
      }));
    const rank = jest
      .fn<VocabularyAssistant['rank']>()
      .mockResolvedValue(['second', 'first']);
    const define = jest.fn<VocabularyAssistant['define']>();
    const vocabulary = new JapaneseVocabulary(
      tokeniser,
      { lookup },
      assistant({ rank, define })
    );

    const result = await vocabulary.analyse({
      expression: '掛ける',
      context: '電話を掛ける。',
    });

    expect(result.candidates.map((candidate) => candidate.id)).toEqual([
      'second',
      'first',
    ]);
    expect(rank).toHaveBeenCalledTimes(1);
    expect(define).not.toHaveBeenCalled();
  });

  it('falls back to the model when the dictionary has no result', async () => {
    const fallback: AssistantCandidate = createTestCandidate();
    const define = jest
      .fn<VocabularyAssistant['define']>()
      .mockResolvedValue([fallback]);
    const vocabulary = new JapaneseVocabulary(
      tokeniser,
      { lookup: () => [] },
      assistant({ define })
    );

    const result = await vocabulary.analyse({ expression: '未知語' });

    expect(result.source).toBe('llm');
    expect(result.candidates[0]?.details?.provenance?.definition).toEqual({
      kind: 'llm',
    });
  });

  it('does not invoke contextual ranking while the model is unavailable', async () => {
    const rank = jest.fn<VocabularyAssistant['rank']>();
    const offlineAssistant = assistant({ rank });
    Object.defineProperty(offlineAssistant, 'availability', {
      value: 'unavailable',
    });
    const vocabulary = new JapaneseVocabulary(
      tokeniser,
      {
        lookup: () => [
          {
            id: 'jmdict:1:0',
            source: 'jmdict',
            entryId: '1',
            senseId: '0',
            expression: '掛ける',
            reading: 'かける',
            meanings: ['to hang'],
            partOfSpeech: ['verb'],
            information: [],
            priority: 3,
          },
        ],
      },
      offlineAssistant
    );

    const result = await vocabulary.analyse({
      expression: '掛ける',
      context: '壁に絵を掛ける。',
    });

    expect(result.source).toBe('dictionary');
    expect(result.candidates).toHaveLength(1);
    expect(rank).not.toHaveBeenCalled();
  });

  it('propagates enrichment failures instead of returning an incomplete candidate', async () => {
    const failure = new Error('invalid model response');
    const vocabulary = new JapaneseVocabulary(
      tokeniser,
      { lookup: () => [] },
      assistant({ addExample: () => Promise.reject(failure) })
    );
    const candidate = createTestCandidate({
      details: { partOfSpeech: ['noun'] },
    });

    await expect(vocabulary.prepare(candidate, '文脈')).rejects.toBe(failure);
  });
});
