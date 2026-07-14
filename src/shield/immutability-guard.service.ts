import { Injectable, Logger } from '@nestjs/common';

export interface ShieldResult {
  sanitized: string;
  tokenMap: Record<string, string>;
}

const PLACEHOLDER_PREFIX = '__LUMINA_SHIELD_';

// Order matters: longer/more-specific patterns first so `{{wallet}}` isn't
// partially consumed by the single-brace `{amount}` pattern, etc.
// One pass is essential. Sequential replacements can create nested shield
// tokens (for example a {{variable}} inside a JSX attribute), making an inner
// token disappear when the containing tag is subsequently shielded.
const PROTECT_PATTERN =
  /<\/?[a-zA-Z][a-zA-Z0-9]*(?:\s+[^<>]*)?\/?>|\{\{[^{}]+\}\}|\$\{[^{}]+\}|\{[^{}]+\}|https?:\/\/[^\s<>"')]+|\b[A-Z0-9]{2,10}\b(?=\s|$|[.,!?;:])/g;

// Common English words that are all-caps in some UI copy (e.g. "OK", "NEW")
// and would be false-positived by the ticker pattern above.
const TICKER_STOPWORDS = new Set(['OK', 'NEW', 'ID', 'URL', 'API', 'FAQ', 'PDF', 'CSV']);

@Injectable()
export class ImmutabilityGuardService {
  private readonly logger = new Logger(ImmutabilityGuardService.name);

  /**
   * Extracts variables, markup, URLs, and asset tickers from `payload`,
   * replacing each with a deterministic placeholder token. Returns the
   * sanitized string plus a map to recover the original values later.
   */
  shieldText(payload: string): ShieldResult {
    let sanitized = payload;
    const tokenMap: Record<string, string> = {};
    let counter = 0;

    sanitized = sanitized.replace(PROTECT_PATTERN, (match) => {
      if (TICKER_STOPWORDS.has(match)) return match;
      const token = `${PLACEHOLDER_PREFIX}${counter}__`;
      tokenMap[token] = match;
      counter += 1;
      return token;
    });

    return { sanitized, tokenMap };
  }

  /**
   * Reinserts shielded values into a translated string. Throws if any
   * expected token is missing from the translated text — a missing token
   * means the LLM dropped a variable, which must fail loudly rather than
   * silently ship a broken translation.
   */
  unshieldText(translatedText: string, tokenMap: Record<string, string>): string {
    let result = translatedText;
    const missing: string[] = [];

    for (const [token, original] of Object.entries(tokenMap)) {
      if (!result.includes(token)) {
        missing.push(token);
        continue;
      }
      result = result.split(token).join(original);
    }

    if (missing.length > 0) {
      this.logger.warn(`unshieldText: missing tokens after translation: ${missing.join(', ')}`);
      throw new Error(
        `Translation dropped ${missing.length} protected token(s): ${missing.join(', ')}`,
      );
    }

    return result;
  }
}
