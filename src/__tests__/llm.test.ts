import assert from 'node:assert/strict';
import test from 'node:test';
import type { WakaruConfig } from '../types.js';
import { analyzeWithOllama } from '../wakaru/llm.js';
import { parseWithSchema, wakaruConfigSchema } from '../wakaru/schemas.js';

const config: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
  llm: {
    provider: 'ollama',
    model: 'test-model',
    apiBase: 'http://ollama.test',
  },
  storage: { wordsDir: '/tmp/wakaru-test' },
  theme: { name: 'night', customPath: '/tmp/theme.json' },
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

test('analyzeWithOllama sends generate request and normalizes candidates', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, init) => {
    assert.equal(requestUrl(url), 'http://ollama.test/api/generate');
    const body = JSON.parse(requestBody(init)) as Record<string, unknown>;
    assert.equal(body.model, 'test-model');
    assert.equal(body.stream, false);
    assert.equal(body.format, 'json');
    assert.match(String(body.prompt), /Anki note fields to populate:/);
    assert.match(String(body.prompt), /Front:/);

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

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.expression, '稼ぐ');
    assert.equal(candidates[0]?.status, 'pending');
    assert.deepEqual(candidates[0]?.tags, ['verb']);
    assert.equal(candidates[0]?.ankiFields.Front, '稼ぐ');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analyzeWithOllama splits large input into stateless chunk requests', async () => {
  const chunkedConfig: WakaruConfig = parseWithSchema(wakaruConfigSchema, {
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

    assert.equal(prompts.length, 3);
    assert.equal(candidates.length, 3);
    assert.ok(prompts.every((prompt) => prompt.includes('Front:')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analyzeWithOllama reports HTTP failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () =>
    Promise.resolve(new Response('nope', { status: 500 }));

  try {
    await assert.rejects(
      analyzeWithOllama(config, '失敗'),
      /Ollama returned HTTP 500/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('analyzeWithOllama reports readable candidate schema errors', async () => {
  const originalFetch = globalThis.fetch;
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
    await assert.rejects(
      analyzeWithOllama(config, '雑な説明だった。'),
      /Ollama candidate response is invalid: candidates.0.meaning: must not be empty/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
