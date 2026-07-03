import { describe, it, expect } from '@jest/globals';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { loadConfig } from '@/client/config.js';
import { getTestConfig } from './config.js';

describe('Config', () => {
  it('loadConfig reads model and export settings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-config-'));
    const path = join(dir, 'config.json');
    const previous = process.env.WAKARU_CONFIG;

    try {
      await writeFile(
        path,
        JSON.stringify(
          getTestConfig({
            model: { name: 'qwen2.5:7b' },
            export: {
              fields: [
                { key: 'Front', inherit: 'expression' },
                { key: 'Back', modelPrompt: 'back field', optional: true },
              ],
            },
          })
        ),
        'utf8'
      );
      process.env.WAKARU_CONFIG = path;

      const config = loadConfig();

      expect(config.model.name).toBe('qwen2.5:7b');
      expect(config.model.apiBase).toBe('http://localhost:11434');
      expect(config.model.maxInputChars).toBe(4_096);
      expect(config.export.fields.map((field) => field.key)).toEqual([
        'Front',
        'Back',
      ]);
      expect(config.export.fields[1]?.optional).toBe(true);
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
          model: { name: '', apiBase: '', maxInputChars: 0 },
          export: { fields: [] },
        }),
        'utf8'
      );
      process.env.WAKARU_CONFIG = path;

      expect(() => loadConfig()).toThrow(
        /Config file .* is invalid: model.name: must not be empty/
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
        model: { name: string };
      };
      expect(saved.model.name).toBe(config.model.name);
    } finally {
      if (previous === undefined) delete process.env.WAKARU_CONFIG;
      else process.env.WAKARU_CONFIG = previous;
      await rm(dir, { recursive: true, force: true });
    }
  });
});
