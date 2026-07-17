import { X402PaymentService } from './x402-payment.service';
import { decodePaymentRequiredHeader } from '@okxweb3/x402-core/http';

describe('X402PaymentService', () => {
  it('leaves bearer-only MCP unchanged when x402 is disabled', async () => {
    const service = new X402PaymentService({ get: jest.fn(() => false) } as never);
    await expect(service.initialize()).resolves.toBeUndefined();

    const next = jest.fn();
    service.middleware()({} as never, {} as never, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails fast when payment access is enabled without a receiving address', async () => {
    const values: Record<string, unknown> = {
      'x402.enabled': true,
      'x402.network': 'eip155:196',
      'x402.price': '$0.01',
    };
    const service = new X402PaymentService({ get: (key: string) => values[key] } as never);
    await expect(service.initialize()).rejects.toThrow('x402.payToAddress');
  });

  it('rejects invalid network, price, and receiving-address configuration before startup', async () => {
    const base: Record<string, unknown> = {
      'x402.enabled': true,
      'x402.network': 'xlayer',
      'x402.price': 'free',
      'x402.payToAddress': 'not-an-address',
      'okx.apiKey': 'key',
      'okx.apiSecret': 'secret',
      'okx.passphrase': 'passphrase',
    };
    const service = new X402PaymentService({ get: (key: string) => base[key] } as never);
    await expect(service.initialize()).rejects.toThrow('X402_NETWORK');
  });

  it('returns an immediate standard v2 challenge without contacting the facilitator', async () => {
    const values: Record<string, unknown> = {
      'x402.enabled': true,
      'x402.network': 'eip155:196',
      'x402.price': '$0.01',
      'x402.payToAddress': '0xfd4995aba036b6ec13c08b56d2f5020bccc8d78b',
      'x402.resourceUrl': 'https://lumina-e3vi.onrender.com/mcp',
      'okx.apiKey': 'key',
      'okx.apiSecret': 'secret',
      'okx.passphrase': 'passphrase',
    };
    const service = new X402PaymentService({ get: (key: string) => values[key] } as never);
    await service.initialize();

    const headers: Record<string, string> = {};
    const response = {
      statusCode: 200,
      body: undefined as unknown,
      setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
      status(code: number) { this.statusCode = code; return this; },
      json(body: unknown) { this.body = body; return this; },
    };
    const next = jest.fn();
    service.middleware()(
      { method: 'POST', path: '/mcp', headers: {} } as never,
      response as never,
      next,
    );

    expect(response.statusCode).toBe(402);
    expect(next).not.toHaveBeenCalled();
    const encoded = headers['payment-required']!;
    const challenge = decodePaymentRequiredHeader(encoded);
    expect(challenge).toMatchObject({
      x402Version: 2,
      resource: { url: 'https://lumina-e3vi.onrender.com/mcp' },
      accepts: [{
        network: 'eip155:196',
        amount: '10000',
        payTo: '0xfd4995aba036b6ec13c08b56d2f5020bccc8d78b',
      }],
    });
  });
});
