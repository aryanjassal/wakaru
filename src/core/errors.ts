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
