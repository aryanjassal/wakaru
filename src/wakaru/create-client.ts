import type { ModelEndpoints } from '@/wakaru/model.js';
import type {
  DictionaryRepository,
  JapaneseTokeniser,
} from '@/wakaru/vocabulary.js';
import type { ExportConfig } from './schema/config.js';

import { Assistant } from '@/wakaru/assistant.js';
import { Wakaru } from '@/wakaru/wakaru.js';
import { JapaneseVocabulary } from '@/wakaru/vocabulary.js';

export type CreateWakaruClientOptions = Readonly<{
  tokeniser: JapaneseTokeniser;
  dictionary: DictionaryRepository;
  model: ModelEndpoints;
  exportConfig: ExportConfig;
  contextWindow?: number | undefined;
}>;

export function createWakaruClient(options: CreateWakaruClientOptions): Wakaru {
  const assistant = new Assistant(options.model, {
    fields: options.exportConfig.fields,
    contextWindow: options.contextWindow,
  });
  const vocabulary = new JapaneseVocabulary(
    options.tokeniser,
    options.dictionary,
    assistant
  );
  return new Wakaru(vocabulary, assistant);
}
