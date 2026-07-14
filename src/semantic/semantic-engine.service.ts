import { Injectable, Logger } from '@nestjs/common';
import { LlmClientService } from './llm-client.service';
import { Web3GlossaryRepository } from '../database/repositories/web3-glossary.repository';

export interface SemanticTranslateRequest {
  /** Shielded text — must contain __LUMINA_SHIELD_N__ placeholders untouched */
  sanitizedText: string;
  targetLanguage: string;
}

@Injectable()
export class SemanticEngineService {
  private readonly logger = new Logger(SemanticEngineService.name);

  constructor(
    private readonly llm: LlmClientService,
    private readonly glossaryRepo: Web3GlossaryRepository,
  ) {}

  async translate(req: SemanticTranslateRequest): Promise<string> {
    return this.translateOne(req.sanitizedText, req.targetLanguage);
  }

  /**
   * Batch variant for full-file jobs (GitOps pipeline). Runs sequentially by
   * default to stay within provider rate limits; caller may parallelize with
   * Promise.all at the batch-size level if their provider tier allows it.
   */
  async translateBatch(
    items: { sanitizedText: string }[],
    targetLanguage: string,
  ): Promise<string[]> {
    const results: string[] = [];
    for (const item of items) {
      results.push(await this.translateOne(item.sanitizedText, targetLanguage));
    }
    return results;
  }

  private async translateOne(sanitizedText: string, targetLanguage: string, correction = false): Promise<string> {
    const relevantTerms = await this.glossaryRepo.findRelevantTerms(sanitizedText);
    const glossaryContext = this.buildGlossaryContext(relevantTerms, targetLanguage);

    const systemPrompt = [
      'You are Lumina, a Web3-specialized localization engine.',
      `Translate the user text into ${targetLanguage} using precise Web3/DeFi terminology, not generic dictionary translation.`,
      'CRITICAL RULES:',
      '1. Any token matching the exact pattern __LUMINA_SHIELD_<number>__ is a protected placeholder. Copy it into the output character-for-character, unmodified, in the same relative position. Never translate, reorder, remove, or alter these tokens.',
      '2. Do not add explanations, quotes, or extra commentary — return only the translated string.',
      '3. Preserve tone and register (UI copy stays concise; error messages stay clear and actionable).',
      glossaryContext ? `4. Apply this verified Web3 glossary where terms appear:\n${glossaryContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const userPrompt = correction
      ? `Your previous output altered or dropped protected __LUMINA_SHIELD_N__ tokens. Re-translate the following text, this time preserving every placeholder exactly:\n\n${sanitizedText}`
      : sanitizedText;

    const result = await this.llm.chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    return result.trim();
  }

  /** Exposed so the Validator can trigger a corrective re-prompt on failure. */
  async translateWithCorrection(sanitizedText: string, targetLanguage: string): Promise<string> {
    return this.translateOne(sanitizedText, targetLanguage, true);
  }

  private buildGlossaryContext(
    terms: { term: string; localizedMappings: Map<string, string> }[],
    targetLanguage: string,
  ): string {
    if (terms.length === 0) return '';
    return terms
      .map((t) => {
        const mapped = t.localizedMappings?.get?.(targetLanguage);
        return mapped ? `- "${t.term}" → "${mapped}"` : `- "${t.term}" (preserve Web3 meaning; no verified mapping yet)`;
      })
      .join('\n');
  }
}
