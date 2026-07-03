import { describe, it, expect } from '@jest/globals';
import { OpenAIModel } from '@/client/model/openai.js';
import { AssistantService } from '@/core/services/assistant.js';
import { WakaruLLMUnavailableError } from '@/core/errors.js';
import { getTestConfig } from './config.js';

describe('OpenAI-compatible model', () => {
  const config = getTestConfig({
    model: {
      name: 'test-model',
      apiBase: 'http://ollama.test',
    },
    export: {
      fields: [
        { key: 'Front', modelPrompt: 'Target expression' },
        { key: 'Notes', modelPrompt: 'Additional context', optional: true },
      ],
    },
  });

  function assistant(): AssistantService {
    return new AssistantService(
      new OpenAIModel({
        model: config.model.name,
        baseUrl: config.model.apiBase,
        apiKey: config.model.apiKey,
      }),
      {
        fields: config.export.fields,
        maxInputChars: config.model.maxInputChars,
      }
    );
  }

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

  function requestPrompt(body: Record<string, unknown>): string {
    const messages = body.messages as readonly { content?: unknown }[];
    return String(messages[0]?.content);
  }

  function modelResponse(content: unknown): Response {
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(content) } }],
      }),
      { status: 200 }
    );
  }

  it('short-circuits model operations after a failed health check', async () => {
    let generationCount = 0;
    const service = new AssistantService(
      {
        checkHealth: () => Promise.resolve(false),
        generate: () => {
          generationCount += 1;
          return Promise.resolve('{}');
        },
      },
      { fields: [], maxInputChars: 1_000 }
    );

    await expect(service.checkHealth()).resolves.toBe(false);
    await expect(
      service.chat([], [{ role: 'user', content: 'hello' }])
    ).rejects.toBeInstanceOf(WakaruLLMUnavailableError);
    expect(generationCount).toBe(0);
  });

  it('analyseWithModel sends a request and normalises candidates', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (url, init) => {
      expect(requestUrl(url)).toBe('http://ollama.test/v1/chat/completions');
      const body = JSON.parse(requestBody(init)) as Record<string, unknown>;
      expect(body.model).toBe('test-model');
      expect(body.response_format).toEqual({ type: 'json_object' });
      const prompt = requestPrompt(body);
      expect(prompt).toMatch(/Word or phrase:/);
      expect(prompt).toMatch(/Context sentence:/);
      expect(prompt).toMatch(/Do not discover extra vocabulary/);
      expect(prompt).toMatch(/Export fields to populate:/);
      expect(prompt).toMatch(/Front \(required\):/);
      expect(prompt).toMatch(/Notes \(optional\):/);

      return Promise.resolve(
        modelResponse({
          candidates: [
            {
              expression: '稼ぐ',
              reading: 'かせぐ',
              meanings: ['to earn'],
              details: {
                contextMeaning: 'to make money',
                partOfSpeech: ['verb'],
                example: {
                  japanese: '彼は生活費を稼いでいる。',
                  english: 'He earns his living expenses.',
                },
              },
              extension: {
                tags: ['verb'],
                exportFields: {
                  Front: '稼ぐ',
                  Back: 'かせぐ\nto earn',
                  Tags: 'wakaru verb',
                  Notes: null,
                },
              },
            },
          ],
        })
      );
    };

    try {
      const candidates = await assistant().define(
        '稼ぐ',
        '彼は生活費を稼いでいる。'
      );

      expect(candidates.length).toBe(1);
      expect(candidates[0]?.expression).toBe('稼ぐ');
      expect(candidates[0]?.extension?.tags).toEqual(['verb']);
      expect(candidates[0]?.extension?.exportFields.Front).toBe('稼ぐ');
      expect(candidates[0]?.extension?.exportFields.Notes).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyseWithModel preserves optional candidate details', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(
        modelResponse({
          candidates: [
            {
              expression: '警察官',
              reading: 'けいさつかん',
              meanings: ['police officer'],
              details: { partOfSpeech: ['noun'] },
              extension: {
                tags: [],
                exportFields: { Front: '警察官', Attempts: '1' },
              },
            },
          ],
        })
      );

    try {
      const candidates = await assistant().define(
        '警察官',
        'はい、私は警察官です。'
      );

      expect(candidates[0]?.expression).toBe('警察官');
      expect(candidates[0]?.reading).toBe('けいさつかん');
      expect(candidates[0]?.meanings).toEqual(['police officer']);
      expect(candidates[0]?.details?.contextMeaning).toBeUndefined();
      expect(candidates[0]?.details?.partOfSpeech).toEqual(['noun']);
      expect(candidates[0]?.extension?.exportFields.Attempts).toBe('1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyseWithModel reports HTTP failures', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = () => {
      requestCount += 1;
      return Promise.resolve(new Response('nope', { status: 500 }));
    };

    try {
      await expect(assistant().define('失敗')).rejects.toThrow(/HTTP 500/);
      expect(requestCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('analyseWithModel succeeds on the third total attempt', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = () => {
      requestCount += 1;
      if (requestCount < 3) {
        return Promise.resolve(new Response('retry', { status: 500 }));
      }
      return Promise.resolve(
        modelResponse({
          candidates: [
            {
              expression: '試す',
              reading: 'ためす',
              meanings: ['to try'],
              extension: {
                tags: [],
                exportFields: { Front: '{試す|ためす}' },
              },
            },
          ],
        })
      );
    };

    try {
      const candidates = await assistant().define('試す');
      expect(candidates[0]?.expression).toBe('試す');
      expect(requestCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('chatWithModel returns markdown and an optional candidate', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = (_url, init) => {
      requestCount += 1;
      const body = JSON.parse(requestBody(init)) as Record<string, unknown>;
      if (requestCount === 2) {
        expect(requestPrompt(body)).toMatch(/independently validating/);
        return Promise.resolve(
          modelResponse({
            candidates: [
              {
                expression: '稼ぐ',
                reading: 'かせぐ',
                meanings: ['to earn'],
                details: {
                  contextMeaning: 'to earn money',
                  partOfSpeech: ['verb'],
                  example: {
                    japanese: '生活費を稼ぐ。',
                    english: 'Earn living expenses.',
                  },
                },
                extension: {
                  tags: ['verb'],
                  exportFields: { Front: '稼ぐ' },
                },
              },
            ],
          })
        );
      }
      expect(requestPrompt(body)).toMatch(/Attached vocabulary context/);
      expect(requestPrompt(body)).toMatch(/USER: Why is this a verb/);
      expect(body.temperature).toBe(0.2);
      return Promise.resolve(
        modelResponse({
          markdown: '**稼ぐ** is a godan verb.',
          candidate: {
            expression: '稼ぐ',
            reading: 'かせぐ',
            meanings: ['to earn'],
            details: {
              contextMeaning: 'to earn money',
              partOfSpeech: ['verb'],
              example: {
                japanese: '生活費を稼ぐ。',
                english: 'Earn living expenses.',
              },
            },
            extension: {
              tags: ['verb'],
              exportFields: { Front: '稼ぐ' },
            },
          },
        })
      );
    };

    try {
      const response = await assistant().chat(
        [
          {
            id: 'saved-1',
            expression: '稼ぐ',
            reading: 'かせぐ',
            meanings: ['to earn'],
            details: {
              contextMeaning: 'to earn money',
              partOfSpeech: ['verb'],
              example: {
                japanese: '生活費を稼ぐ。',
                english: 'Earn living expenses.',
              },
            },
            extension: {
              tags: ['verb'],
              exportFields: { Front: '稼ぐ' },
            },
          },
        ],
        [{ role: 'user', content: 'Why is this a verb?' }],
        { temperature: 0.2 }
      );
      expect(response.markdown).toMatch(/godan verb/);
      expect(response.candidate?.meanings).toEqual(['to earn']);
      expect(requestCount).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('assistant reports readable candidate schema errors', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = () => {
      requestCount += 1;
      return Promise.resolve(
        modelResponse({
          candidates: [
            {
              expression: '雑',
              reading: 'ざつ',
              meanings: [''],
            },
          ],
        })
      );
    };

    try {
      await expect(
        assistant().define('雑', '雑な説明だった。')
      ).rejects.toThrow(
        /candidate response is invalid: candidates.0.meanings.0: must not be empty/
      );
      expect(requestCount).toBe(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
