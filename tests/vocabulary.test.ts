import { describe, expect, it, jest } from '@jest/globals';
import type { MiningCandidate } from '@/core/types.js';
import type {
  DictionaryRepository,
  JapaneseTokeniser,
  VocabularyModel,
} from '@/core/vocabulary.js';
import { DefaultVocabularyService } from '@/core/vocabulary.js';
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

function model(overrides: Partial<VocabularyModel> = {}): VocabularyModel {
  return {
    rank: () => Promise.resolve([]),
    define: () => Promise.resolve([]),
    addExample: (candidate) => Promise.resolve(candidate),
    ...overrides,
  };
}

describe('DefaultVocabularyService', () => {
  it('uses token lemmas for dictionary lookup', async () => {
    const lookup = jest
      .fn<DictionaryRepository['lookup']>()
      .mockImplementation(() => [
        {
          id: 'jmdict:1:0',
          source: 'jmdict',
          expression: '稼ぐ',
          reading: 'かせぐ',
          meanings: ['to earn'],
          partOfSpeech: ['verb'],
          information: [],
          priority: 3,
        },
      ]);
    const service = new DefaultVocabularyService(
      tokeniser,
      { lookup },
      model()
    );

    const result = await service.analyse({ expression: '稼いでいる' });

    expect(lookup.mock.calls[0]?.[0]).toContain('稼ぐ');
    expect(result.source).toBe('dictionary');
    expect(result.candidates[0]?.definitionSource).toBe('jmdict');
  });

  it('uses the model only to rank dictionary candidates in context', async () => {
    const lookup: DictionaryRepository['lookup'] = () =>
      ['first', 'second'].map((id, index) => ({
        id,
        source: 'jmdict' as const,
        expression: '掛ける',
        reading: 'かける',
        meanings: [`meaning ${index}`],
        partOfSpeech: ['verb'],
        information: [],
        priority: 3,
      }));
    const rank = jest
      .fn<VocabularyModel['rank']>()
      .mockResolvedValue(['second', 'first']);
    const define = jest.fn<VocabularyModel['define']>();
    const service = new DefaultVocabularyService(
      tokeniser,
      { lookup },
      model({ rank, define })
    );

    const result = await service.analyse({
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
    const fallback: MiningCandidate = createTestCandidate();
    const define = jest
      .fn<VocabularyModel['define']>()
      .mockResolvedValue([fallback]);
    const service = new DefaultVocabularyService(
      tokeniser,
      { lookup: () => [] },
      model({ define })
    );

    const result = await service.analyse({ expression: '未知語' });

    expect(result.source).toBe('llm');
    expect(result.candidates[0]?.definitionSource).toBe('llm');
  });
});
