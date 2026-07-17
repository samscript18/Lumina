import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OKXFacilitatorClient } from '@okxweb3/x402-core';
import { encodePaymentRequiredHeader } from '@okxweb3/x402-core/http';
import { ExactEvmScheme } from '@okxweb3/x402-evm/exact/server';
import { paymentMiddleware, x402ResourceServer } from '@okxweb3/x402-express';
import type { Network, PaymentRequired } from '@okxweb3/x402-core/types';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthenticatedRequest } from '../common/guards/api-key.guard';

export interface X402AuthenticatedRequest extends AuthenticatedRequest {
  luminaPayment?: {
    protocol: 'x402';
    network: string;
  };
}

@Injectable()
export class X402PaymentService {
  private readonly logger = new Logger(X402PaymentService.name);
  private handler?: RequestHandler;
  private facilitatorReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {}

  async initialize(): Promise<void> {
    if (!this.config.get<boolean>('x402.enabled')) {
      this.logger.warn('x402 payment access is disabled; MCP remains bearer-only');
      return;
    }

    const network = this.required('x402.network');
    const price = this.required('x402.price');
    const payTo = this.required('x402.payToAddress');
    const apiKey = this.required('okx.apiKey');
    const secretKey = this.required('okx.apiSecret');
    const passphrase = this.required('okx.passphrase');

    if (network !== 'eip155:196') {
      throw new Error('X402_NETWORK must be eip155:196 for X Layer mainnet');
    }
    if (!/^\$\d+(?:\.\d{1,6})?$/.test(price) || Number(price.slice(1)) <= 0) {
      throw new Error('X402_PRICE_USD must be a positive USD price such as $0.01');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(payTo)) {
      throw new Error('X402_PAY_TO_ADDRESS must be a valid EVM address');
    }

    const facilitator = new OKXFacilitatorClient({
      apiKey,
      secretKey,
      passphrase,
      syncSettle: true,
    });
    const resourceServer = new x402ResourceServer(facilitator).register(
      network as Network,
      new ExactEvmScheme(),
    );

    const challenge = this.buildChallenge(network, price, payTo);

    const paidMcp = paymentMiddleware(
      {
        'POST /mcp': {
          accepts: {
            scheme: 'exact',
            network: network as Network,
            payTo,
            price,
            maxTimeoutSeconds: 300,
          },
          resource: this.config.get<string>('x402.resourceUrl') ?? 'https://lumina-e3vi.onrender.com/mcp',
          description: 'Lumina semantic localization and onchain error intelligence',
          mimeType: 'application/json',
          unpaidResponseBody: () => ({
            contentType: 'application/json',
            body: {
              error: 'Payment required',
              service: 'Lumina Semantic Localizer',
            },
          }),
        },
      },
      resourceServer,
      undefined,
      undefined,
      false,
    );

    this.handler = (request: Request, response: Response, next: NextFunction) => {
      if (request.method !== 'POST' || request.path !== '/mcp') return next();

      // Existing SDK and operator clients may continue to use scoped bearer
      // credentials. Marketplace callers without a bearer key use x402.
      if (/^Bearer\s+\S+/i.test(request.headers.authorization ?? '')) return next();

      const paymentHeader = request.headers['payment-signature'] ?? request.headers['x-payment'];
      if (!paymentHeader) {
        response.setHeader('PAYMENT-REQUIRED', encodePaymentRequiredHeader(challenge));
        response.status(402).json(challenge);
        return;
      }

      const facilitatorReady = this.facilitatorReady ??= resourceServer.initialize().catch((error: unknown) => {
        this.facilitatorReady = undefined;
        throw error;
      });
      void facilitatorReady
        .then(() => paidMcp(request, response, () => {
          const paidRequest = request as X402AuthenticatedRequest;
          paidRequest.luminaPayment = { protocol: 'x402', network };
          next();
        }))
        .catch(next);
    };

    this.logger.log(`x402 payment access initialized on ${network} at ${price} per MCP request`);
  }

  middleware(): RequestHandler {
    return (request, response, next) => {
      if (!this.handler) return next();
      return this.handler(request, response, next);
    };
  }

  private required(key: string): string {
    const value = this.config.get<string>(key)?.trim();
    if (!value) throw new Error(`Missing required x402 configuration: ${key}`);
    return value;
  }

  private buildChallenge(network: string, price: string, payTo: string): PaymentRequired {
    const [whole = '0', fraction = ''] = price.slice(1).split('.');
    const amount = (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))).toString();
    return {
      x402Version: 2,
      resource: {
        url: this.config.get<string>('x402.resourceUrl') ?? 'https://lumina-e3vi.onrender.com/mcp',
        description: 'Lumina semantic localization and onchain error intelligence',
        mimeType: 'application/json',
      },
      accepts: [{
        scheme: 'exact',
        network: network as Network,
        asset: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
        amount,
        payTo,
        maxTimeoutSeconds: 300,
        extra: { name: 'USD₮0', version: '1' },
      }],
    };
  }
}
