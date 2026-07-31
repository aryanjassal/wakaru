import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_OPENAI_BASE_URL,
  checkOpenAICompatibleHealth,
  completeOpenAICompatible,
} from '@/wakaru/model.js';
import {
  WakaruProviderRequestError,
  WakaruProviderResponseError,
} from '@/wakaru/errors.js';

describe('OpenAI-compatible model endpoints', () => {
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
      await expect(
        checkOpenAICompatibleHealth({ model: 'test-model' })
      ).resolves.toBe(true);
      await expect(
        completeOpenAICompatible(
          { model: 'test-model' },
          { prompt: 'test', responseFormat: 'json' }
        )
      ).resolves.toBe('{"ok":true}');
      expect(urls).toEqual([
        `${DEFAULT_OPENAI_BASE_URL}/v1/models`,
        `${DEFAULT_OPENAI_BASE_URL}/v1/chat/completions`,
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports an unavailable endpoint without throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.reject(new Error('connection refused'));

    try {
      await expect(
        checkOpenAICompatibleHealth({ model: 'test-model' })
      ).resolves.toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns named provider errors with structured status', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve(new Response('unavailable', { status: 503 }));

    try {
      const operation = completeOpenAICompatible(
        { model: 'test-model' },
        { prompt: 'test' }
      );
      await expect(operation).rejects.toMatchObject({
        name: 'WakaruProviderRequestError',
        status: 503,
      });
      await expect(operation).rejects.toBeInstanceOf(
        WakaruProviderRequestError
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('uses a named error for an empty provider response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => Promise.resolve(Response.json({ choices: [] }));

    try {
      await expect(
        completeOpenAICompatible({ model: 'test-model' }, { prompt: 'test' })
      ).rejects.toBeInstanceOf(WakaruProviderResponseError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
