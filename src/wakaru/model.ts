export type ModelGenerationRequest = Readonly<{
  prompt: string;
  temperature?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}>;

export type ModelEndpoints = Readonly<{
  checkHealth: () => Promise<boolean>;
  complete: (request: ModelGenerationRequest) => Promise<string>;
}>;

export type LLMAvailability = 'unchecked' | 'available' | 'unavailable';

import { parseJsonText } from './validation.js';
import {
  WakaruProviderRequestError,
  WakaruProviderResponseError,
} from './errors.js';

export const DEFAULT_BASE_URL = 'https://api.openai.com';
const HEALTH_PATH = '/v1/models';
const COMPLETIONS_PATH = '/v1/chat/completions';

export type OpenAIModelConfig = Readonly<{
  kind?: 'openai' | undefined;
  model: string;
  apiKey?: string | null | undefined;
  baseUrl?: string | undefined;
  fetch?: typeof fetch | undefined;
}>;

export type CustomModelConfig = Readonly<{
  kind: 'custom';
  checkHealth: () => Promise<boolean>;
  complete: (request: ModelGenerationRequest) => Promise<string>;
}>;

export type ModelEndpointConfig = OpenAIModelConfig | CustomModelConfig;

export function createModelEndpoints(
  config: ModelEndpointConfig
): ModelEndpoints {
  if (config.kind === 'custom') {
    return {
      checkHealth: config.checkHealth,
      complete: config.complete,
    };
  }
  return createOpenAIEndpoints(config);
}

export function createOpenAIEndpoints(
  config: OpenAIModelConfig
): ModelEndpoints {
  return {
    checkHealth: () => checkOpenAIHealth(config),
    complete: (request) => completeOpenAI(config, request),
  };
}

export async function checkOpenAIHealth(
  config: OpenAIModelConfig
): Promise<boolean> {
  try {
    const response = await modelFetch(config)(modelUrl(config, HEALTH_PATH), {
      method: 'GET',
      headers: modelHeaders(config),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function completeOpenAI(
  config: OpenAIModelConfig,
  request: ModelGenerationRequest
): Promise<string> {
  const response = await modelFetch(config)(
    modelUrl(config, COMPLETIONS_PATH),
    {
      method: 'POST',
      headers: modelHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? 0,
        ...(request.responseFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    }
  ).catch((cause: unknown) => {
    throw new WakaruProviderRequestError(
      'The model provider request failed.',
      undefined,
      { cause }
    );
  });
  if (!response.ok) {
    throw new WakaruProviderRequestError(
      `API returned HTTP ${response.status}.`,
      response.status
    );
  }

  const parsed = parseJsonText(await response.text(), 'Model response');
  if (!parsed.success) throw parsed.error;
  const payload = parsed.value as {
    error?: { message?: unknown };
    choices?: readonly { message?: { content?: unknown } }[];
  };
  if (typeof payload.error?.message === 'string') {
    throw new WakaruProviderResponseError(payload.error.message);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new WakaruProviderResponseError(
      'The model returned an empty response.'
    );
  }
  return content;
}

function modelFetch(config: OpenAIModelConfig): typeof fetch {
  return config.fetch ?? fetch;
}

function modelHeaders(config: OpenAIModelConfig): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

function modelUrl(config: OpenAIModelConfig, path: string): string {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
