import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDir } from '@/client/config.js';
import { resolveUserPath } from '@/client/utils.js';
import { WakaruAssetNotFoundError } from '@/client/errors.js';

export function exportDirectory(): string {
  return configDir();
}

export function wordDatabasePath(): string {
  return resolveUserPath(
    process.env.WAKARU_WORD_DATABASE ?? join(configDir(), 'words.sqlite')
  );
}

export function dictionaryPath(): string {
  return resolveAssetPath(process.env.WAKARU_DICTIONARY, 'dictionary.sqlite');
}

export function tokeniserDictionaryPath(): string {
  return resolveAssetPath(process.env.WAKARU_TOKENISER_DICTIONARY, 'kuromoji');
}

function resolveAssetPath(override: string | undefined, name: string): string {
  if (override) return resolveUserPath(override);

  const packaged = fileURLToPath(new URL(`./assets/${name}`, import.meta.url));
  if (existsSync(packaged)) return packaged;

  const source = fileURLToPath(
    new URL(`../../assets/runtime/${name}`, import.meta.url)
  );
  if (existsSync(source)) return source;

  throw new WakaruAssetNotFoundError(name);
}
