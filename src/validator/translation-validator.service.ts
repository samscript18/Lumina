import { Injectable, Logger } from '@nestjs/common';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class TranslationValidatorService {
  private readonly logger = new Logger(TranslationValidatorService.name);

  /**
   * Validates a single translated (still-shielded) string before it is
   * unshielded and persisted. Checks:
   *  - non-empty
   *  - every expected shield token is present exactly once
   *  - no stray/unknown shield-looking tokens were invented by the LLM
   */
  validateShieldedTranslation(translated: string, expectedTokens: string[]): ValidationResult {
    const errors: string[] = [];

    if (!translated || translated.trim().length === 0) {
      errors.push('Translation output is empty.');
    }

    for (const token of expectedTokens) {
      const occurrences = translated.split(token).length - 1;
      if (occurrences === 0) {
        errors.push(`Missing expected token: ${token}`);
      } else if (occurrences > 1) {
        errors.push(`Token duplicated unexpectedly: ${token}`);
      }
    }

    const foundTokens = translated.match(/__LUMINA_SHIELD_\d+__/g) ?? [];
    const unknown = foundTokens.filter((t) => !expectedTokens.includes(t));
    if (unknown.length > 0) {
      errors.push(`Unknown/invented token(s) in output: ${unknown.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validates a full reconstructed JSON payload (post-unshield) before it is
   * returned to the caller or committed via GitOps: must parse as valid JSON,
   * contain no empty string leaf values, and introduce no syntax breakage.
   */
  validateJsonPayload(payload: unknown): ValidationResult {
    const errors: string[] = [];

    let serialized: string;
    try {
      serialized = JSON.stringify(payload);
    } catch (err) {
      return { valid: false, errors: [`Payload is not JSON-serializable: ${(err as Error).message}`] };
    }

    try {
      JSON.parse(serialized);
    } catch (err) {
      errors.push(`Reconstructed payload does not parse as valid JSON: ${(err as Error).message}`);
    }

    const emptyPaths: string[] = [];
    this.findEmptyStrings(payload, [], emptyPaths);
    if (emptyPaths.length > 0) {
      errors.push(`Empty string value(s) at: ${emptyPaths.join(', ')}`);
    }

    if (errors.length > 0) {
      this.logger.warn(`Payload validation failed: ${errors.join(' | ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  private findEmptyStrings(node: unknown, path: (string | number)[], out: string[]): void {
    if (typeof node === 'string') {
      if (node.trim().length === 0) out.push(path.join('.'));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => this.findEmptyStrings(item, [...path, idx], out));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        this.findEmptyStrings(value, [...path, key], out);
      }
    }
  }
}
