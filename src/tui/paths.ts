import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveUserPath } from '@/client/utils.js';

export function tuiWordsDir(): string {
  return resolveUserPath(
    process.env.WAKARU_WORDS_DIR ?? '~/.config/wakaru/words'
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

  throw new Error(`Required Wakaru asset is missing: ${name}`);
}
