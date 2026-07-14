export type SourceFormat = 'json' | 'ts-i18n' | 'js-i18n';
export type SwapMode = 'exactIn' | 'exactOut';

export interface LuminaClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
}

export interface RequestOptions { signal?: AbortSignal; requestId?: string }
export interface TranslateTextInput { text: string; targetLanguage: string }
export interface TranslateTextResult { translated: string }
export interface TranslateFileInput { content: string; format: SourceFormat; targetLanguage: string }
export interface TranslateFileResult {
  targetLanguage: string;
  translated: unknown;
  stats: { totalStrings: number; cacheHits: number; llmCalls: number; validationRetries: number };
}
export interface DecodeErrorInput { code: string; targetLanguage?: string }
export interface DecodedError {
  code: string; api: string; officialMessage: string; language: string;
  message: string; actionable: string; probableCause: string; retryable: boolean;
}
export interface GlossaryEntry {
  term: string; domainContext: string; localizedMappings: Record<string, string>;
}
export interface QuoteInput {
  chainIndex: string; amount: string; fromTokenAddress: string; toTokenAddress: string;
  swapMode?: SwapMode; targetLanguage?: string;
}
export type QuoteResult =
  | { success: true; data: unknown }
  | { success: false; rawCode: string; rawMessage: string; decoded: DecodedError | null };
export interface MetricsSnapshot {
  counters: Record<string, number>;
  collectedAt: string;
}
export interface McpServerConfig {
  type: 'streamable-http';
  url: string;
  headers: { Authorization: string };
}

export interface ApiSuccess<T> { success: true; data: T }
export interface ApiFailure {
  success: false;
  error: { statusCode: number; code: string; message: string | string[] };
  timestamp: string;
}
