import type { ModelGenerationRequest, ModelService } from '@/core/model.js';

import { parseJsonText } from '@/core/utils.js';

export const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com';

export type OpenAIPaths = Readonly<{
  health: string;
  completions: string;
}>;

export const DEFAULT_OPENAI_PATHS = {
  health: '/v1/models',
  completions: '/v1/chat/completions',
} as const satisfies OpenAIPaths;

export type OpenAIModelOptions = Readonly<{
  model: string;
  apiKey?: string | null | undefined;
  baseUrl?: string | undefined;
  paths?: Partial<OpenAIPaths> | undefined;
}>;

export class OpenAIModel implements ModelService {
  private readonly model: string;
  private readonly apiKey: string | null | undefined;
  private readonly baseUrl: string;
  private readonly paths: OpenAIPaths;

  constructor(options: OpenAIModelOptions) {
    this.model = options.model;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_OPENAI_BASE_URL;
    this.paths = { ...DEFAULT_OPENAI_PATHS, ...options.paths };
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(this.url(this.paths.health), {
        method: 'GET',
        headers: this.headers(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async generate(request: ModelGenerationRequest): Promise<string> {
    const response = await fetch(this.url(this.paths.completions), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? 0,
        ...(request.responseFormat === 'json'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });
    if (!response.ok) throw new Error(`API returned HTTP ${response.status}.`);

    const parsed = parseJsonText(await response.text(), 'Model response');
    if (!parsed.success) throw parsed.error;
    const payload = parsed.value as {
      error?: { message?: unknown };
      choices?: readonly { message?: { content?: unknown } }[];
    };
    if (typeof payload.error?.message === 'string') {
      throw new Error(payload.error.message);
    }
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('The model returned an empty response.');
    }
    return content;
  }

  /**
   * Generate headers containing useful metadata like the content type and the
   * authentication metadata.
   * @returns JSON headers including authentication metadata
   */
  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  private url(path: string): string {
    // Remove trailing slash from baseUrl and leading slash from path before
    // combining them.
    return `${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
