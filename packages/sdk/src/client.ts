import { LuminaApiError } from './errors.js';
import type {
  ApiFailure, ApiSuccess, DecodeErrorInput, DecodedError, GlossaryEntry, LuminaClientOptions,
  McpServerConfig, MetricsSnapshot, QuoteInput, QuoteResult, RequestOptions, TranslateFileInput, TranslateFileResult,
  TranslateTextInput, TranslateTextResult,
} from './types.js';

const DEFAULT_BASE_URL = 'https://lumina-e3vi.onrender.com';

export class LuminaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetcher: typeof globalThis.fetch;
  private readonly userAgent: string | undefined;
  private readonly maxRetries: number;

  constructor(options: LuminaClientOptions) {
    if (!options.apiKey?.trim()) throw new TypeError('LuminaClient requires a non-empty apiKey');
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.userAgent = options.userAgent;
    this.maxRetries = Math.max(0, Math.min(5, options.maxRetries ?? 2));
    if (typeof this.fetcher !== 'function') throw new TypeError('A Fetch API implementation is required');
  }

  translateText(input: TranslateTextInput, options?: RequestOptions): Promise<TranslateTextResult> {
    return this.request('/api/v1/translate/string', { method: 'POST', body: input }, options);
  }

  translateFile(input: TranslateFileInput, options?: RequestOptions): Promise<TranslateFileResult> {
    return this.request('/api/v1/translate/file', { method: 'POST', body: input }, options);
  }

  decodeError(input: DecodeErrorInput, options?: RequestOptions): Promise<DecodedError> {
    return this.request('/api/v1/decode-error', { method: 'POST', body: input }, options);
  }

  getQuote(input: QuoteInput, options?: RequestOptions): Promise<QuoteResult> {
    return this.request('/api/v1/onchain/quote', { method: 'POST', body: input }, options);
  }

  glossary(input: { term?: string; domainContext?: string } = {}, options?: RequestOptions): Promise<GlossaryEntry | GlossaryEntry[]> {
    const query = new URLSearchParams();
    if (input.term) query.set('term', input.term);
    if (input.domainContext) query.set('domainContext', input.domainContext);
    const suffix = query.size > 0 ? `?${query}` : '';
    return this.request(`/api/v1/glossary${suffix}`, { method: 'GET' }, options);
  }

  metrics(options?: RequestOptions): Promise<MetricsSnapshot> {
    return this.request('/api/v1/metrics', { method: 'GET' }, options);
  }

  mcpServerConfig(): McpServerConfig {
    return { type: 'streamable-http', url: `${this.baseUrl}/mcp`, headers: { Authorization: `Bearer ${this.apiKey}` } };
  }

  private async request<T>(
    path: string,
    request: { method: 'GET' | 'POST'; body?: unknown },
    options?: RequestOptions,
  ): Promise<T> {
    const attempts = request.method === 'GET' ? this.maxRetries + 1 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try { return await this.requestOnce<T>(path, request, options); }
      catch (error) {
        lastError = error;
        if (!(error instanceof LuminaApiError) || !error.retryable || attempt === attempts - 1 || options?.signal?.aborted) throw error;
        await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt) + Math.floor(Math.random() * 100)));
      }
    }
    throw lastError;
  }

  private async requestOnce<T>(
    path: string,
    request: { method: 'GET' | 'POST'; body?: unknown },
    options?: RequestOptions,
  ): Promise<T> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new DOMException('Lumina request timed out', 'TimeoutError')), this.timeoutMs);
    const signal = options?.signal ? AbortSignal.any([options.signal, timeout.signal]) : timeout.signal;
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options?.requestId) headers['X-Request-Id'] = options.requestId;
    if (this.userAgent && typeof process !== 'undefined') headers['User-Agent'] = this.userAgent;

    try {
      const init: RequestInit = {
        method: request.method,
        headers,
        signal,
      };
      if (request.body !== undefined) init.body = JSON.stringify(request.body);
      const response = await this.fetcher(`${this.baseUrl}${path}`, init);
      const body = await this.parseJson<ApiSuccess<T> | ApiFailure>(response);
      if (!response.ok || !body || body.success !== true) {
        throw LuminaApiError.fromResponse(response, body?.success === false ? body : undefined);
      }
      return body.data;
    } catch (error) {
      if (error instanceof LuminaApiError) throw error;
      if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) {
        throw new LuminaApiError({ message: error.message, status: 0, code: error.name.toUpperCase(), retryable: true });
      }
      throw new LuminaApiError({
        message: error instanceof Error ? error.message : 'Lumina network request failed',
        status: 0,
        code: 'NETWORK_ERROR',
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseJson<T>(response: Response): Promise<T | undefined> {
    const text = await response.text();
    if (!text) return undefined;
    try { return JSON.parse(text) as T; }
    catch { throw new LuminaApiError({ message: 'Lumina returned invalid JSON', status: response.status, code: 'INVALID_RESPONSE' }); }
  }
}
