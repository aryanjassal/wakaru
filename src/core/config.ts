import type { WakaruConfig } from './types.js';

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import {
  parseJsonText,
  parseWithSchema,
  wakaruConfigSchema,
} from './schemas.js';

function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

export function resolveUserPath(path: string): string {
  return resolve(expandHome(path));
}

export function configPath(): string {
  return resolveUserPath(
    process.env.WAKARU_CONFIG ?? '~/.config/wakaru/config.json'
  );
}

export function configDir(): string {
  return dirname(configPath());
}

export function loadConfig(): WakaruConfig {
  const path = configPath();
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    return parseWithSchema(wakaruConfigSchema, {}, `Config file ${path}`);
  }

  const text = readFileSync(path, 'utf8');
  const parsed = parseJsonText(text, `Config file ${path}`);
  if (!parsed.success) throw parsed.error;
  return parseWithSchema(
    wakaruConfigSchema,
    parsed.value,
    `Config file ${path}`
  );
}
