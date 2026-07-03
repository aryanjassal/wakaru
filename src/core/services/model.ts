export type ModelGenerationRequest = Readonly<{
  prompt: string;
  temperature?: number | undefined;
  responseFormat?: 'json' | 'text' | undefined;
}>;

export interface ModelService {
  checkHealth(): Promise<boolean>;
  generate(request: ModelGenerationRequest): Promise<string>;
}

export type LLMAvailability = 'unchecked' | 'available' | 'unavailable';
