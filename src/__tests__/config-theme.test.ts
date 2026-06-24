import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configureCustomTheme, themeSpec } from '../theme.js';
import { loadConfig } from '../wakaru/config.js';

test('loadConfig reads LLM, storage, and theme settings', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wakaru-config-'));
  const path = join(dir, 'config.json');
  const previous = process.env.WAKARU_CONFIG;

  try {
    await writeFile(
      path,
      JSON.stringify({
        llm: { model: 'qwen2.5:7b', apiBase: 'http://localhost:11434/' },
        storage: { wordsDir: join(dir, 'words') },
        theme: { name: 'custom', customPath: join(dir, 'theme.json') },
        anki: {
          fields: [
            { name: 'Front', purpose: 'front field' },
            { name: 'Back', purpose: 'back field' },
          ],
        },
      }),
      'utf8'
    );
    process.env.WAKARU_CONFIG = path;

    const config = loadConfig();

    assert.equal(config.llm.model, 'qwen2.5:7b');
    assert.equal(config.llm.apiBase, 'http://localhost:11434');
    assert.equal(config.llm.maxInputChars, 4_000);
    assert.equal(config.storage.wordsDir, join(dir, 'words'));
    assert.equal(config.theme.name, 'custom');
    assert.deepEqual(
      config.anki.fields.map((field) => field.name),
      ['Front', 'Back']
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

test('loadConfig reports readable validation errors', async () => {
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

    assert.throws(
      () => loadConfig(),
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

test('custom theme json can be loaded without recompiling', async () => {
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
    assert.equal(themeSpec('custom').label, 'Matcha');

    const raw = await readFile(path, 'utf8');
    assert.match(raw, /Matcha/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('custom theme json reports readable color errors', async () => {
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

    assert.throws(
      () => configureCustomTheme(path),
      /Theme file .* is invalid: colors.accent: must be a 6-digit hex color/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
