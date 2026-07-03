import type { ClientConfig } from './schema/config.js';
import type { ModelService } from '@/core/model.js';
import type { WakaruServices } from '@/core/wakaru.js';
import type {
  DictionaryRepository,
  JapaneseTokeniser,
  VocabularyInput,
} from '@/core/vocabulary.js';

import { AssistantService } from '@/core/assistant.js';
import { Wakaru } from '@/core/wakaru.js';
import { DefaultVocabularyService } from '@/core/vocabulary.js';
import { JmdictDictionary } from './dictionary/jmdict.js';
import { OpenAIModel } from './model/openai.js';
import { KuromojiTokeniser } from './tokeniser/kuromoji.js';

export type CreateWakaruOptions = Readonly<{
  config: ClientConfig;
  dictionaryPath: string;
  tokeniserDictionaryPath: string;
  dictionary?: DictionaryRepository | undefined;
  tokeniser?: JapaneseTokeniser | undefined;
  model?: ModelService | undefined;
}>;

export function createWakaru(options: CreateWakaruOptions): Wakaru {
  const tokeniser =
    options.tokeniser ?? new KuromojiTokeniser(options.tokeniserDictionaryPath);
  const dictionary =
    options.dictionary ?? new JmdictDictionary(options.dictionaryPath);
  const model =
    options.model ??
    new OpenAIModel({
      model: options.config.model.name,
      apiKey: options.config.model.apiKey,
      baseUrl: options.config.model.apiBase,
    });
  const assistant = new AssistantService(model, {
    fields: options.config.export.fields,
    maxInputChars: options.config.model.maxInputChars,
  });
  const vocabulary = new DefaultVocabularyService(
    tokeniser,
    dictionary,
    assistant
  );
  return new Wakaru({ vocabulary, conversation: assistant });
}

export function createCustomWakaru<Input extends VocabularyInput>(
  services: WakaruServices<Input>
): Wakaru<Input> {
  return new Wakaru(services);
}
