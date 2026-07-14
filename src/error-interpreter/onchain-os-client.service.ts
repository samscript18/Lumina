import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface QuoteParams {
  chainIndex: string;
  amount: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  swapMode?: 'exactIn' | 'exactOut';
}

export interface OnchainOsEnvelope<T> {
  code: string;
  msg: string;
  data: T;
}

/**
 * Client for OKX OnchainOS's authenticated REST API
 * (https://web3.okx.com/onchainos/dev-docs/trade/dex-get-quote), implementing
 * OKX's standard request-signing scheme:
 *   sign = base64(HMAC_SHA256(secret, `${timestamp}${method}${requestPath}${body}`))
 * sent as OK-ACCESS-KEY / OK-ACCESS-SIGN / OK-ACCESS-PASSPHRASE / OK-ACCESS-TIMESTAMP.
 *
 * Requires OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE to be configured
 * (obtained from the OKX OnchainOS developer portal). If unset, calls fail
 * fast with a clear error rather than silently no-op'ing.
 */
@Injectable()
export class OnchainOsClientService {
  private readonly logger = new Logger(OnchainOsClientService.name);
  private readonly baseUrl = 'https://web3.okx.com';

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('okx.apiKey') &&
        this.config.get<string>('okx.apiSecret') &&
        this.config.get<string>('okx.passphrase'),
    );
  }

  /**
   * Fetches a live swap quote from OKX OnchainOS. On a non-"0" business
   * error code, returns the raw {code, msg} so ErrorInterpreterService can
   * decode it through the same dictionary used for manually-reported codes —
   * this is what makes Module 7 a real integration rather than a static
   * lookup table fed by guesses.
   */
  async getQuote(params: QuoteParams): Promise<OnchainOsEnvelope<unknown>> {
    const query = new URLSearchParams({
      chainIndex: params.chainIndex,
      amount: params.amount,
      fromTokenAddress: params.fromTokenAddress,
      toTokenAddress: params.toTokenAddress,
      swapMode: params.swapMode ?? 'exactIn',
    }).toString();

    const requestPath = `/api/v6/dex/aggregator/quote?${query}`;
    const headers = this.buildAuthHeaders('GET', requestPath, '');

    const response = await fetch(`${this.baseUrl}${requestPath}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(this.config.get<number>('requestTimeoutMs') ?? 15_000),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(`OKX OnchainOS returned HTTP ${response.status}`);
    }
    const envelope = (await response.json()) as OnchainOsEnvelope<unknown>;

    if (envelope.code !== '0') {
      this.logger.warn(`OnchainOS quote returned business error ${envelope.code}: ${envelope.msg}`);
    }

    return envelope;
  }

  private buildAuthHeaders(method: string, requestPath: string, body: string): Record<string, string> {
    const apiKey = this.config.get<string>('okx.apiKey');
    const apiSecret = this.config.get<string>('okx.apiSecret');
    const passphrase = this.config.get<string>('okx.passphrase');

    if (!apiKey || !apiSecret || !passphrase) {
      throw new ServiceUnavailableException(
        'OKX OnchainOS credentials are not configured (OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE). ' +
          'Generate these from the OnchainOS developer portal: https://web3.okx.com/onchainos/dev-docs/home/developer-portal',
      );
    }

    const timestamp = new Date().toISOString();
    const prehash = `${timestamp}${method}${requestPath}${body}`;
    const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');

    return {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': sign,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    };
  }
}
