import type { ClientConfig } from './schema/config.js';

import type { Wakaru } from '@/wakaru/wakaru.js';
import { createWakaruClient } from './create-client.js';
import { JmdictDictionary } from './dictionary/jmdict.js';
import { createModelEndpoints } from './model.js';
import { KuromojiTokeniser } from './tokeniser/kuromoji.js';

export type CreateWakaruOptions = Readonly<{
  config: ClientConfig;
  dictionaryPath: string;
  tokeniserDictionaryPath: string;
}>;

export function createWakaru(options: CreateWakaruOptions): Wakaru {
  const tokeniser = new KuromojiTokeniser(options.tokeniserDictionaryPath);
  const dictionary = new JmdictDictionary(options.dictionaryPath);
  const model = createModelEndpoints({
    model: options.config.model.name,
    apiKey: options.config.model.apiKey,
    baseUrl: options.config.model.apiBase,
  });
  return createWakaruClient({
    tokeniser,
    dictionary,
    model,
    exportConfig: options.config.export,
    contextWindow: options.config.model.contextWindow,
  });
}
