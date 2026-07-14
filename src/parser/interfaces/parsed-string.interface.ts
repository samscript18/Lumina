export interface ExtractedString {
  /** Dot/bracket path back to the original location, e.g. "wallet.errors[0].title" */
  keyPath: (string | number)[];
  value: string;
}

export type SourceFormat = 'json' | 'ts-i18n' | 'js-i18n';

export interface ParseResult {
  format: SourceFormat;
  strings: ExtractedString[];
  /** Original parsed structure, used as the skeleton for reconstruction */
  skeleton: unknown;
  /** Exact input bytes, retained for lossless no-op round trips. */
  sourceContent: string;
}
