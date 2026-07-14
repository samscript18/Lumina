import { Injectable, NotFoundException } from '@nestjs/common';
import { TranslationService } from '../translation/translation.service';
import { lookupOnchainError } from './dictionaries/onchain-errors.dictionary';
import { OnchainOsClientService, QuoteParams } from './onchain-os-client.service';

export interface DecodedError {
  code: string;
  api: string;
  officialMessage: string;
  language: string;
  message: string;
  actionable: string;
  probableCause: string;
  retryable: boolean;
}

@Injectable()
export class ErrorInterpreterService {
  constructor(
    private readonly translationService: TranslationService,
    private readonly onchainOsClient: OnchainOsClientService,
  ) {}

  async decode(rawCode: string, targetLanguage = 'en'): Promise<DecodedError> {
    const entry = lookupOnchainError(rawCode);
    if (!entry) {
      throw new NotFoundException(
        `Unknown OKX OnchainOS error code: "${rawCode}". See https://web3.okx.com/onchainos/dev-docs/trade/dex-error-code and https://web3.okx.com/onchainos/dev-docs/trade/onchain-gateway-error-code for the full list.`,
      );
    }

    if (targetLanguage.toLowerCase() === 'en') {
      return {
        code: entry.code,
        api: entry.api,
        officialMessage: entry.officialMessage,
        language: 'en',
        message: entry.plainEnglish,
        actionable: entry.actionable,
        probableCause: entry.plainEnglish,
        retryable: entry.httpStatus === 429 || entry.httpStatus >= 500 || ['50011', '50026', '82116', '81451'].includes(entry.code),
      };
    }

    // Reuse the full Semantic Engine pipeline (glossary + shielding + validation)
    // rather than hardcoding per-language copies of every error message.
    const [message, actionable] = await Promise.all([
      this.translationService.translateString(entry.plainEnglish, targetLanguage),
      this.translationService.translateString(entry.actionable, targetLanguage),
    ]);

    return {
      code: entry.code, api: entry.api, officialMessage: entry.officialMessage,
      language: targetLanguage, message, actionable, probableCause: message,
      retryable: entry.httpStatus === 429 || entry.httpStatus >= 500 || ['50011', '50026', '82116', '81451'].includes(entry.code),
    };
  }

  /**
   * Fetches a real quote from OKX OnchainOS. If OnchainOS returns a business
   * error (code !== "0"), that exact code is run back through decode() so
   * the same localized/actionable explanation applies to live failures as to
   * manually-reported ones — this is the real integration, not a demo stub.
   */
  async getLiveQuote(params: QuoteParams, targetLanguage = 'en') {
    const envelope = await this.onchainOsClient.getQuote(params);

    if (envelope.code !== '0') {
      const decoded = await this.decode(envelope.code, targetLanguage).catch(() => null);
      return {
        success: false as const,
        rawCode: envelope.code,
        rawMessage: envelope.msg,
        decoded,
      };
    }

    return { success: true as const, data: envelope.data };
  }

  isLiveQuotingConfigured(): boolean {
    return this.onchainOsClient.isConfigured();
  }
}
