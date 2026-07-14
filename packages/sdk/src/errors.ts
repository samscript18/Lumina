import type { ApiFailure } from './types.js';

export class LuminaApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly retryable: boolean;

  constructor(input: { message: string; status: number; code: string; requestId?: string; retryable?: boolean }) {
    super(input.message);
    this.name = 'LuminaApiError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? (input.status === 429 || input.status >= 500);
  }

  static fromResponse(response: Response, body: ApiFailure | undefined): LuminaApiError {
    const raw = body?.error?.message;
    const message = Array.isArray(raw) ? raw.join('; ') : raw ?? `Lumina API returned HTTP ${response.status}`;
    const requestId = response.headers.get('x-request-id') ?? undefined;
    return new LuminaApiError({
      message,
      status: response.status,
      code: body?.error?.code ?? 'HTTP_ERROR',
      ...(requestId ? { requestId } : {}),
    });
  }
}
