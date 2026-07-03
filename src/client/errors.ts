export class WakaruClientError extends Error {
  public override readonly name: string = 'WakaruClientError';
}

export class WakaruProviderRequestError extends WakaruClientError {
  public override readonly name = 'WakaruProviderRequestError';

  public constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions
  ) {
    super(message, options);
  }
}

export class WakaruProviderResponseError extends WakaruClientError {
  public override readonly name = 'WakaruProviderResponseError';

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class WakaruAssetNotFoundError extends WakaruClientError {
  public override readonly name = 'WakaruAssetNotFoundError';

  public constructor(public readonly asset: string) {
    super(`Required Wakaru asset is missing: ${asset}`);
  }
}

export class WakaruFormattingSyntaxError extends WakaruClientError {
  public override readonly name = 'WakaruFormattingSyntaxError';
}
