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

import { parseJsonText } from './validation/json.js';
import {
  WakaruProviderRequestError,
  WakaruProviderResponseError,
} from './errors.js';

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';
const HEALTH_PATH = '/v1/models';
const COMPLETIONS_PATH = '/v1/chat/completions';

export type OpenAICompatibleModelConfig = Readonly<{
  kind?: 'openai-compatible' | undefined;
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

export type ModelEndpointConfig =
  OpenAICompatibleModelConfig | CustomModelConfig;

export function createModelEndpoints(
  config: ModelEndpointConfig
): ModelEndpoints {
  if (config.kind === 'custom') {
    return {
      checkHealth: config.checkHealth,
      complete: config.complete,
    };
  }
  return createOpenAICompatibleEndpoints(config);
}

export function createOpenAICompatibleEndpoints(
  config: OpenAICompatibleModelConfig
): ModelEndpoints {
  return {
    checkHealth: () => checkOpenAICompatibleHealth(config),
    complete: (request) => completeOpenAICompatible(config, request),
  };
}

export async function checkOpenAICompatibleHealth(
  config: OpenAICompatibleModelConfig
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

export async function completeOpenAICompatible(
  config: OpenAICompatibleModelConfig,
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

function modelFetch(config: OpenAICompatibleModelConfig): typeof fetch {
  return config.fetch ?? fetch;
}

function modelHeaders(
  config: OpenAICompatibleModelConfig
): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

function modelUrl(config: OpenAICompatibleModelConfig, path: string): string {
  const baseUrl = config.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
