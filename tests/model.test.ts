import { describe, expect, it } from '@jest/globals';
import { DEFAULT_OPENAI_BASE_URL, OpenAIModel } from '@/client/model/openai.js';

describe('OpenAIModel', () => {
  function requestUrl(input: Parameters<typeof fetch>[0]): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
  }

  it('provides default health and completion endpoints', async () => {
    const originalFetch = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (input) => {
      urls.push(requestUrl(input));
      if (urls.length === 1) return Promise.resolve(new Response('{}'));
      return Promise.resolve(
        Response.json({ choices: [{ message: { content: '{"ok":true}' } }] })
      );
    };

    try {
      const model = new OpenAIModel({ model: 'test-model' });
      await expect(model.checkHealth()).resolves.toBe(true);
      await expect(
        model.generate({ prompt: 'test', responseFormat: 'json' })
      ).resolves.toBe('{"ok":true}');
      expect(urls).toEqual([
        `${DEFAULT_OPENAI_BASE_URL}/v1/models`,
        `${DEFAULT_OPENAI_BASE_URL}/v1/chat/completions`,
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('supports provider-specific endpoint overrides', async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = '';
    globalThis.fetch = (input) => {
      requestedUrl = requestUrl(input);
      return Promise.resolve(
        Response.json({ choices: [{ message: { content: 'ok' } }] })
      );
    };

    try {
      const model = new OpenAIModel({
        model: 'test-model',
        baseUrl: 'https://models.example/',
        paths: { completions: '/chat' },
      });
      await model.generate({ prompt: 'test' });
      expect(requestedUrl).toBe('https://models.example/chat');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
