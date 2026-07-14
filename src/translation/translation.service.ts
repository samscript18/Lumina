import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import * as crypto from 'crypto';
import { ContextParserService } from '../parser/context-parser.service';
import { ImmutabilityGuardService } from '../shield/immutability-guard.service';
import { SemanticEngineService } from '../semantic/semantic-engine.service';
import { TranslationValidatorService } from '../validator/translation-validator.service';
import { RedisService } from '../cache/redis.service';
import { TranslationCacheRepository } from '../database/repositories/translation-cache.repository';
import { MetricsService } from '../metrics/metrics.service';
import { SourceFormat } from '../parser/interfaces/parsed-string.interface';

export interface TranslateFileRequest {
  content: string;
  format: SourceFormat;
  targetLanguage: string;
}

export interface TranslateFileResult {
  targetLanguage: string;
  translated: unknown;
  stats: {
    totalStrings: number;
    cacheHits: number;
    llmCalls: number;
    validationRetries: number;
  };
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly parser: ContextParserService,
    private readonly guard: ImmutabilityGuardService,
    private readonly semanticEngine: SemanticEngineService,
    private readonly validator: TranslationValidatorService,
    private readonly redis: RedisService,
    private readonly cacheRepo: TranslationCacheRepository,
    private readonly metrics: MetricsService,
  ) {}

  /** Translates a single raw string end-to-end. Used by the MCP translate_text tool. */
  async translateString(sourceText: string, targetLanguage: string): Promise<string> {
    this.metrics.increment('translation_requests_total');
    const result = await this.translateOneShielded(sourceText, targetLanguage);
    return result.translated;
  }

  /** Translates a full localization file end-to-end (parse -> shield -> translate -> validate -> unshield -> reconstruct). */
  async translateFile(req: TranslateFileRequest): Promise<TranslateFileResult> {
    this.metrics.increment('translation_requests_total');
    const parsed = this.parser.parse(req.content, req.format);

    const stats = { totalStrings: parsed.strings.length, cacheHits: 0, llmCalls: 0, validationRetries: 0 };
    const translatedEntries = [];

    for (const entry of parsed.strings) {
      const outcome = await this.translateOneShielded(entry.value, req.targetLanguage);
      if (outcome.fromCache) stats.cacheHits += 1;
      else stats.llmCalls += 1;
      stats.validationRetries += outcome.retries;
      translatedEntries.push({ keyPath: entry.keyPath, value: outcome.translated });
    }

    const reconstructed = this.parser.reconstruct(parsed.skeleton, translatedEntries);

    const payloadCheck = this.validator.validateJsonPayload(reconstructed);
    if (!payloadCheck.valid) {
      throw new UnprocessableEntityException(
        `Reconstructed translation failed validation: ${payloadCheck.errors.join('; ')}`,
      );
    }

    return { targetLanguage: req.targetLanguage, translated: reconstructed, stats };
  }

  /**
   * Core single-string pipeline shared by translateString and translateFile:
   * cache check -> shield -> semantic translate -> validate (+ one corrective
   * retry) -> unshield -> cache write.
   */
  private async translateOneShielded(
    sourceText: string,
    targetLanguage: string,
  ): Promise<{ translated: string; fromCache: boolean; retries: number }> {
    // 1. Redis fast-path cache
    const cached = await this.redis.get(sourceText, targetLanguage);
    if (cached) {
      this.metrics.increment('cache_hits_total');
      return { translated: cached, fromCache: true, retries: 0 };
    }

    // 2. Mongo persistent cache (survives Redis eviction/restart)
    const stringHash = crypto
      .createHash('md5')
      .update(`${sourceText}::${targetLanguage}`)
      .digest('hex');
    const persisted = await this.cacheRepo.findByHash(stringHash);
    if (persisted) {
      this.metrics.increment('cache_hits_total');
      await this.cacheRepo.registerHit(stringHash);
      await this.redis.set(sourceText, targetLanguage, persisted.translatedText);
      return { translated: persisted.translatedText, fromCache: true, retries: 0 };
    }

    const lockKey = RedisService.hashKey(sourceText, targetLanguage);
    const lockToken = await this.redis.acquireLock(lockKey);
    if (!lockToken) {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const completed = await this.redis.get(sourceText, targetLanguage);
        if (completed) {
          this.metrics.increment('cache_hits_total');
          return { translated: completed, fromCache: true, retries: 0 };
        }
      }
      throw new UnprocessableEntityException('Translation is still being processed; retry shortly.');
    }

    try {
      // 3. Shield -> LLM -> validate -> (retry once on failure) -> unshield
      const { sanitized, tokenMap } = this.guard.shieldText(sourceText);
    const expectedTokens = Object.keys(tokenMap);

    this.metrics.increment('llm_calls_total');
    let shieldedTranslation = await this.semanticEngine.translate({
      sanitizedText: sanitized,
      targetLanguage,
    });
    let check = this.validator.validateShieldedTranslation(shieldedTranslation, expectedTokens);
    let retries = 0;

    if (!check.valid) {
      this.metrics.increment('validator_rejections_total');
      this.metrics.increment('validator_retries_total');
      this.metrics.increment('llm_calls_total');
      this.logger.warn(`Validation failed, retrying once: ${check.errors.join('; ')}`);
      shieldedTranslation = await this.semanticEngine.translateWithCorrection(sanitized, targetLanguage);
      check = this.validator.validateShieldedTranslation(shieldedTranslation, expectedTokens);
      retries = 1;
    }

    if (!check.valid) {
      this.metrics.increment('validator_rejections_total');
      throw new UnprocessableEntityException(
        `Translation failed validation after retry: ${check.errors.join('; ')}`,
      );
    }

    const finalTranslation = this.guard.unshieldText(shieldedTranslation, tokenMap);

    // 4. Write through both cache layers
    await this.cacheRepo.upsert({ stringHash, sourceText, targetLanguage, translatedText: finalTranslation });
    await this.redis.set(sourceText, targetLanguage, finalTranslation);

      return { translated: finalTranslation, fromCache: false, retries };
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }
}
