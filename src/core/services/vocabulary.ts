import type { AssistantCandidate } from './../types.js';
import type { LLMAvailability } from './model.js';

export type JapaneseToken = Readonly<{
  surface: string;
  lemma: string;
  reading?: string | undefined;
  partOfSpeech: readonly string[];
  unknown: boolean;
}>;

export interface JapaneseTokeniser {
  tokenise(text: string): Promise<readonly JapaneseToken[]>;
}

export type DictionarySense = Readonly<{
  id: string;
  source: string;
  expression: string;
  reading: string;
  meanings: readonly string[];
  partOfSpeech: readonly string[];
  information: readonly string[];
  priority: number;
}>;

export interface DictionaryRepository {
  lookup(
    keys: readonly string[],
    limit?: number
  ): readonly DictionarySense[] | Promise<readonly DictionarySense[]>;
}

export interface VocabularyModel {
  readonly availability?: LLMAvailability;
  rank(
    expression: string,
    context: string,
    candidates: readonly AssistantCandidate[]
  ): Promise<readonly string[]>;
  define(
    expression: string,
    context?: string
  ): Promise<readonly AssistantCandidate[]>;
  addExample(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate>;
}

export interface VocabularyInput {
  expression: string;
  context?: string | undefined;
  limit?: number | undefined;
}

export type AnalyseVocabularyInput = Readonly<VocabularyInput>;

export type AnalyseVocabularyResult = Readonly<{
  tokens: readonly JapaneseToken[];
  candidates: readonly AssistantCandidate[];
  source: 'dictionary' | 'dictionary+llm' | 'llm';
}>;

function katakanaToHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (character) =>
    String.fromCharCode(character.charCodeAt(0) - 0x60)
  );
}

function dictionaryCandidate(sense: DictionarySense): AssistantCandidate {
  return {
    id: sense.id,
    expression: sense.expression,
    reading: sense.reading,
    meanings: sense.meanings,
    details: {
      ...(sense.partOfSpeech.length
        ? { partOfSpeech: sense.partOfSpeech }
        : {}),
      ...(sense.information.length
        ? { nuance: sense.information.join('; ') }
        : {}),
      provenance: { definition: sense.source },
    },
    extension: { tags: [sense.source], exportFields: {} },
  };
}

export interface VocabularyService<
  Input extends VocabularyInput = AnalyseVocabularyInput,
> {
  analyse(input: Input): Promise<AnalyseVocabularyResult>;
  prepare(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate>;
}

export class DefaultVocabularyService<
  Input extends VocabularyInput = AnalyseVocabularyInput,
> implements VocabularyService<Input> {
  constructor(
    private readonly tokeniser: JapaneseTokeniser,
    private readonly dictionary: DictionaryRepository,
    private readonly model: VocabularyModel
  ) {}

  public async analyse(input: Input): Promise<AnalyseVocabularyResult> {
    const expression = input.expression.normalize('NFKC').trim();
    if (!expression)
      return { tokens: [], candidates: [], source: 'dictionary' };

    const tokens = await this.tokeniser.tokenise(expression);
    const keys = new Set<string>([expression]);
    for (const token of tokens) {
      keys.add(token.surface);
      keys.add(token.lemma);
      if (token.reading) keys.add(katakanaToHiragana(token.reading));
    }

    const senses = await this.dictionary.lookup([...keys], 30);
    let candidates = senses.map(dictionaryCandidate);
    let modelRanked = false;
    const context = input.context?.trim();
    if (!candidates.length) {
      const generated = await this.model.define(expression, context);
      return {
        tokens,
        candidates: generated.map((candidate) => ({
          ...candidate,
          details: {
            ...candidate.details,
            provenance: {
              ...candidate.details?.provenance,
              definition: 'llm',
            },
          },
        })),
        source: 'llm',
      };
    }

    if (context && this.model.availability !== 'unavailable') {
      try {
        const rankedIds = await this.model.rank(
          expression,
          context,
          candidates
        );
        const positions = new Map(rankedIds.map((id, index) => [id, index]));
        candidates = [...candidates].sort(
          (left, right) =>
            (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
        );
        modelRanked = true;
      } catch {
        // Dictionary results remain usable when the optional model is offline.
      }
    }

    return {
      tokens,
      candidates: candidates.slice(0, input.limit ?? 3),
      source: modelRanked ? 'dictionary+llm' : 'dictionary',
    };
  }

  public async prepare(
    candidate: AssistantCandidate,
    context?: string
  ): Promise<AssistantCandidate> {
    if (candidate.details?.example?.japanese.trim()) return candidate;
    if (this.model.availability === 'unavailable') return candidate;
    try {
      return await this.model.addExample(candidate, context);
    } catch {
      return candidate;
    }
  }
}
