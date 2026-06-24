import { describe, it, expect } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { configureCustomTheme, themeSpec } from '../theme.js';
import { loadConfig } from '../wakaru/config.js';
import { getTestConfig } from './config.js';

describe('Config and Theme', () => {
  it('loadConfig reads LLM, storage, and theme settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-config-'));
    const path = join(dir, 'config.json');
    const previous = process.env.WAKARU_CONFIG;

    try {
      await writeFile(
        path,
        JSON.stringify(
          getTestConfig({
            storage: { wordsDir: join(dir, 'words') },
            theme: { name: 'custom', customPath: join(dir, 'theme.json') },
            anki: {
              fields: [
                { name: 'Front', purpose: 'front field' },
                { name: 'Back', purpose: 'back field' },
              ],
            },
          })
        ),
        'utf8'
      );
      process.env.WAKARU_CONFIG = path;

      const config = loadConfig();

      expect(config.llm.model).toBe('qwen2.5:7b');
      expect(config.llm.apiBase).toBe('http://localhost:11434');
      expect(config.llm.maxInputChars).toBe(4_000);
      expect(config.storage.wordsDir).toBe(join(dir, 'words'));
      expect(config.theme.name).toBe('custom');
      expect(config.anki.fields.map((field) => field.name)).toEqual([
        'Front',
        'Back',
      ]);
    } finally {
      if (previous === undefined) {
        delete process.env.WAKARU_CONFIG;
      } else {
        process.env.WAKARU_CONFIG = previous;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('loadConfig reports readable validation errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-config-invalid-'));
    const path = join(dir, 'config.json');
    const previous = process.env.WAKARU_CONFIG;

    try {
      await writeFile(
        path,
        JSON.stringify({
          llm: { provider: 'openai', model: '' },
          theme: { name: 'neon' },
        }),
        'utf8'
      );
      process.env.WAKARU_CONFIG = path;

      expect(() => loadConfig()).toThrow(
        /Config file .* is invalid: llm.provider: Invalid input: expected "ollama"/
      );
    } finally {
      if (previous === undefined) {
        delete process.env.WAKARU_CONFIG;
      } else {
        process.env.WAKARU_CONFIG = previous;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('custom theme json can be loaded without recompiling', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-theme-'));
    const path = join(dir, 'theme.json');

    try {
      await writeFile(
        path,
        JSON.stringify({
          label: 'Matcha',
          colors: {
            base: '#101510',
            panel: '#1c281d',
            text: '#eef5ea',
            accent: '#8bcf8b',
          },
        }),
        'utf8'
      );

      configureCustomTheme(path);
      expect(themeSpec('custom').label).toBe('Matcha');

      const raw = await readFile(path, 'utf8');
      expect(raw).toMatch(/Matcha/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('custom theme json reports readable color errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-theme-invalid-'));
    const path = join(dir, 'theme.json');

    try {
      await writeFile(
        path,
        JSON.stringify({
          label: 'Bad',
          colors: {
            accent: 'green',
          },
        }),
        'utf8'
      );

      expect(() => configureCustomTheme(path)).toThrow(
        /Theme file .* is invalid: colors.accent: must be a 6-digit hex color/
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
