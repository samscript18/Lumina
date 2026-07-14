import { LuminaClient } from './index.js';

describe('LuminaClient', () => {
  it('sends bearer authentication and returns typed data', async () => {
    const fetcher = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer secret');
      return new Response(JSON.stringify({ success: true, data: { translated: 'Trocar {amount} ETH' } }), {
        status: 201, headers: { 'content-type': 'application/json', 'x-request-id': 'req-1' },
      });
    });
    const client = new LuminaClient({ apiKey: 'secret', fetch: fetcher as typeof fetch });
    await expect(client.translateText({ text: 'Swap {amount} ETH', targetLanguage: 'pt-BR' }))
      .resolves.toEqual({ translated: 'Trocar {amount} ETH' });
  });

  it('normalizes API failures with request IDs', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      success: false, error: { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Slow down' }, timestamp: '',
    }), { status: 429, headers: { 'x-request-id': 'req-2' } }));
    const client = new LuminaClient({ apiKey: 'secret', fetch: fetcher as typeof fetch, maxRetries: 0 });
    await expect(client.glossary()).rejects.toMatchObject({
      status: 429, code: 'TOO_MANY_REQUESTS', requestId: 'req-2', retryable: true,
    });
  });

  it('retries transient read failures but never retries translation posts', async () => {
    const readFetcher = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: { statusCode: 503, code: 'UNAVAILABLE', message: 'wait' } }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    const client = new LuminaClient({ apiKey: 'secret', fetch: readFetcher as typeof fetch, maxRetries: 1 });
    await expect(client.glossary()).resolves.toEqual([]);
    expect(readFetcher).toHaveBeenCalledTimes(2);

    const postFetcher = jest.fn(async () => new Response(JSON.stringify({ success: false, error: { statusCode: 503, code: 'UNAVAILABLE', message: 'wait' } }), { status: 503 }));
    const postClient = new LuminaClient({ apiKey: 'secret', fetch: postFetcher as typeof fetch });
    await expect(postClient.translateText({ text: 'Swap', targetLanguage: 'fr' })).rejects.toBeDefined();
    expect(postFetcher).toHaveBeenCalledTimes(1);
  });

  it('provides a typed MCP connection descriptor', () => {
    expect(new LuminaClient({ apiKey: 'secret' }).mcpServerConfig()).toEqual({
      type: 'streamable-http', url: 'https://lumina-e3vi.onrender.com/mcp', headers: { Authorization: 'Bearer secret' },
    });
  });
});
