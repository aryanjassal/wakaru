export class WakaruError extends Error {
  public override readonly name: string = 'WakaruError';
}

export class WakaruLLMUnavailableError extends WakaruError {
  public override readonly name = 'WakaruLLMUnavailableError';

  public constructor() {
    super('The language model is unavailable while Wakaru is offline.');
  }
}

export class WakaruModelOperationError extends WakaruError {
  public override readonly name: string = 'WakaruModelOperationError';
}

export class WakaruModelResponseError extends WakaruModelOperationError {
  public override readonly name = 'WakaruModelResponseError';
}

export class WakaruInvalidInputError extends WakaruError {
  public override readonly name = 'WakaruInvalidInputError';
}

export class JsonValidationError extends WakaruError {
  public override readonly name = 'JsonValidationError';

  public constructor(
    message: string,
    public readonly issues: readonly string[]
  ) {
    super(message);
  }
}

export class WakaruProviderRequestError extends WakaruError {
  public override readonly name = 'WakaruProviderRequestError';

  public constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

export class WakaruProviderResponseError extends WakaruError {
  public override readonly name = 'WakaruProviderResponseError';

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class WakaruAssetNotFoundError extends WakaruError {
  public override readonly name = 'WakaruAssetNotFoundError';

  public constructor(public readonly asset: string) {
    super(`Required Wakaru asset is missing: ${asset}`);
  }
}

export class WakaruFormattingSyntaxError extends WakaruError {
  public override readonly name = 'WakaruFormattingSyntaxError';
}

export class WakaruDuplicateDictionarySenseError extends WakaruError {
  public override readonly name = 'WakaruDuplicateDictionarySenseError';

  public constructor(public readonly existingWordId: string) {
    super('This dictionary sense is already saved.');
  }
}

export class WakaruExportSchemaError extends WakaruError {
  public override readonly name = 'WakaruExportSchemaError';
}
