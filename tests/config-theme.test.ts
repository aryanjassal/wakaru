import { describe, it, expect } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { loadConfig } from '@/core/config.js';
import { colorscheme } from '../src/tui/lib/theme.js';
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
            theme: { name: 'night' },
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
      expect(config.llm.maxInputChars).toBe(4_096);
      expect(config.storage.wordsDir).toBe(join(dir, 'words'));
      expect(config.theme.name).toBe('night');
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

  it('loadConfig writes the default config when it is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-config-default-'));
    const path = join(dir, 'config.json');
    const previous = process.env.WAKARU_CONFIG;
    process.env.WAKARU_CONFIG = path;

    try {
      const config = loadConfig();
      const saved = JSON.parse(await readFile(path, 'utf8')) as {
        llm: { model: string };
      };
      expect(saved.llm.model).toBe(config.llm.model);
    } finally {
      if (previous === undefined) delete process.env.WAKARU_CONFIG;
      else process.env.WAKARU_CONFIG = previous;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('TUI exposes only the built-in night theme', () => {
    expect(colorscheme.bg).toBe('#1a1b26');
    expect(colorscheme.primary).toBe('#bb9af7');
  });
});
