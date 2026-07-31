import type { ClientConfig } from './schema/config.js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseJsonText, parseWithSchema } from '@/wakaru/validation/json.js';
import { clientConfigSchema } from './schema/config.js';
import { resolveUserPath } from './utils.js';

const DEFAULT_CONFIG: ClientConfig = {
  model: {
    name: 'gemma4:12b',
    apiBase: 'http://localhost:11434',
    contextWindow: 32_768,
  },
  export: {
    fields: [
      {
        key: 'expression',
        inherit: 'expression',
      },
      {
        key: 'sentence',
        modelPrompt: 'Make a sentence with the input word',
      },
    ],
  },
};

export function configPath(): string {
  return resolveUserPath(
    process.env.WAKARU_CONFIG ?? '~/.config/wakaru/config.json'
  );
}

export function configDir(): string {
  return dirname(configPath());
}

export function loadConfig(): ClientConfig {
  const path = configPath();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    const config = parseWithSchema(
      clientConfigSchema,
      DEFAULT_CONFIG,
      `Config file ${path}`
    );
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    return config;
  }

  const text = readFileSync(path, 'utf8');
  const parsed = parseJsonText(text, `Config file ${path}`);
  if (!parsed.success) throw parsed.error;
  return parseWithSchema(
    clientConfigSchema,
    parsed.value,
    `Config file ${path}`
  );
}

export function writeConfig(config: ClientConfig): void {
  const path = configPath();
  const valid = parseWithSchema(clientConfigSchema, config, 'Config');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(valid, null, 2)}\n`, 'utf8');
}
