import type { JapaneseToken, JapaneseTokeniser } from '@/wakaru/vocabulary.js';
import type { IpadicFeatures, Tokenizer } from 'kuromoji';

import kuromoji from 'kuromoji';

export class KuromojiTokeniser implements JapaneseTokeniser {
  private tokeniser: Promise<Tokenizer<IpadicFeatures>> | null = null;

  public constructor(private readonly dictionaryPath: string) {}

  public async tokenise(text: string): Promise<readonly JapaneseToken[]> {
    return this.getTokeniser().then((tokeniser) =>
      tokeniser.tokenize(text).map((token) => ({
        surface: token.surface_form,
        lemma:
          token.basic_form && token.basic_form !== '*'
            ? token.basic_form
            : token.surface_form,
        ...(token.reading ? { reading: token.reading } : {}),
        partOfSpeech: [
          token.pos,
          token.pos_detail_1,
          token.pos_detail_2,
          token.pos_detail_3,
        ].filter((value) => value && value !== '*'),
        unknown: token.word_type === 'UNKNOWN',
      }))
    );
  }

  private getTokeniser(): Promise<Tokenizer<IpadicFeatures>> {
    this.tokeniser ??= new Promise((resolve, reject) => {
      kuromoji
        .builder({ dicPath: this.dictionaryPath })
        .build((error, tokeniser) => {
          if (error) reject(error);
          else resolve(tokeniser);
        });
    });
    return this.tokeniser;
  }
}
