import { describe, it, expect } from '@jest/globals';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeWithOllama } from '@/core/llm.js';
import { getTestConfig } from './config.js';

describe('LLM', () => {
  const config = getTestConfig({
    llm: {
      provider: 'ollama',
      model: 'test-model',
      apiBase: 'http://ollama.test',
    },
    storage: { wordsDir: '/tmp/wakaru-test' },
    theme: { name: 'night' },
    anki: {
      fields: [{ name: 'Front', purpose: 'Target expression' }],
    },
  });

  function requestUrl(input: Parameters<typeof fetch>[0]): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }

  function requestBody(init: Parameters<typeof fetch>[1]): string {
    if (typeof init?.body !== 'string') {
      throw new Error('Expected string request body.');
    }
    return init.body;
  }

  it('analyzeWithOllama sends generate request and normalizes candidates', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
      expect(requestUrl(url)).toBe('http://ollama.test/api/generate');
      const body = JSON.parse(requestBody(init)) as Record<string, unknown>;
      expect(body.model).toBe('test-model');
      expect(body.stream).toBe(false);
      expect(body.format).toBe('json');
      expect(String(body.prompt)).toMatch(/Anki note fields to populate:/);
      expect(String(body.prompt)).toMatch(/Front:/);

      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              candidates: [
                {
                  expression: '稼ぐ',
                  reading: 'かせぐ',
                  meaning: 'to earn',
                  contextMeaning: 'to make money',
                  partOfSpeech: 'verb',
                  exampleJapanese: '彼は生活費を稼いでいる。',
                  exampleEnglish: 'He earns his living expenses.',
                  tags: ['verb'],
                  ankiFields: {
                    Front: '稼ぐ',
                    Back: 'かせぐ<br>to earn',
                    Tags: 'wakaru verb',
                  },
                },
              ],
            }),
          }),
          { status: 200 }
        )
      );
    };

    try {
      const candidates = await analyzeWithOllama(
        config,
        '彼は生活費を稼いでいる。'
      );

      expect(candidates.length).toBe(1);
      expect(candidates[0]?.expression).toBe('稼ぐ');
      expect(candidates[0]?.status).toBe('pending');
      expect(candidates[0]?.tags).toEqual(['verb']);
      expect(candidates[0]?.ankiFields.Front).toBe('稼ぐ');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyzeWithOllama splits large input into stateless chunk requests', async () => {
    const chunkedConfig = getTestConfig({
      llm: {
        provider: 'ollama',
        model: 'test-model',
        apiBase: 'http://ollama.test',
        maxInputChars: 12,
      },
      storage: { wordsDir: '/tmp/wakaru-test' },
      anki: {
        fields: [{ name: 'Front', purpose: 'Target expression' }],
      },
    });
    const originalFetch = globalThis.fetch;
    const prompts: string[] = [];

    globalThis.fetch = (_url, init) => {
      const body = JSON.parse(requestBody(init)) as Record<string, unknown>;
      prompts.push(String(body.prompt));
      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              candidates: [
                {
                  expression: `語${prompts.length}`,
                  reading: 'ご',
                  meaning: 'word',
                  contextMeaning: 'word in context',
                  partOfSpeech: 'noun',
                  exampleJapanese: '語を読む。',
                  exampleEnglish: 'Read the word.',
                  tags: ['noun'],
                  ankiFields: { Front: `語${prompts.length}` },
                },
              ],
            }),
          }),
          { status: 200 }
        )
      );
    };

    try {
      const candidates = await analyzeWithOllama(
        chunkedConfig,
        '一二三四五六七八九十\n\nabcdefghij\n\nABCDEFGHIJ'
      );

      expect(prompts.length).toBe(3);
      expect(candidates.length).toBe(3);
      expect(prompts.every((prompt) => prompt.includes('Front:'))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyzeWithOllama tolerates common model response shape drift', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify([
              {
                word: '警察官',
                furigana: 'けいさつかん',
                definition: 'police officer',
                part_of_speech: 'noun',
                pitchAccent: '0',
                fields: {
                  Front: '警察官',
                  Attempts: 1,
                },
              },
            ]),
          }),
          { status: 200 }
        )
      );

    try {
      const candidates = await analyzeWithOllama(
        config,
        'はい、私は警察官です。'
      );

      expect(candidates[0]?.expression).toBe('警察官');
      expect(candidates[0]?.reading).toBe('けいさつかん');
      expect(candidates[0]?.meaning).toBe('police officer');
      expect(candidates[0]?.contextMeaning).toBe('police officer');
      expect(candidates[0]?.partOfSpeech).toBe('noun');
      expect(candidates[0]?.ankiFields.Attempts).toBe('1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyzeWithOllama reports HTTP failures', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response('nope', { status: 500 }));

    try {
      await expect(analyzeWithOllama(config, '失敗')).rejects.toThrow(
        /HTTP 500/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyzeWithOllama reports readable candidate schema errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wakaru-llm-log-'));
    const previousConfig = process.env.WAKARU_CONFIG;
    const originalFetch = globalThis.fetch;
    process.env.WAKARU_CONFIG = join(dir, 'config.json');
    globalThis.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              candidates: [
                {
                  expression: '雑',
                  reading: 'ざつ',
                  meaning: '',
                  contextMeaning: 'rough',
                  partOfSpeech: 'na-adjective',
                  exampleJapanese: '雑な説明だった。',
                  exampleEnglish: 'It was a rough explanation.',
                },
              ],
            }),
          }),
          { status: 200 }
        )
      );

    try {
      await expect(
        analyzeWithOllama(config, '雑な説明だった。')
      ).rejects.toThrow(
        /candidate response is invalid: candidates.0.meaning: must not be empty/
      );
      const log = await readFile(join(dir, 'ollama-failures.jsonl'), 'utf8');
      const entry = JSON.parse(log.trim()) as Record<string, unknown>;
      expect(entry.model).toBe('test-model');
      expect(entry.inputText).toBe('雑な説明だった。');
      expect(String(entry.responseText)).toMatch(/雑/);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousConfig === undefined) {
        delete process.env.WAKARU_CONFIG;
      } else {
        process.env.WAKARU_CONFIG = previousConfig;
      }
      await rm(dir, { recursive: true, force: true });
    }
  });
});
