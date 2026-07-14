import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServerService } from './mcp-server.service';

describe('McpServerService contract', () => {
  it('lists and invokes all public tools over MCP', async () => {
    const translation = { translateString: jest.fn(async () => 'Connectez votre portefeuille') };
    const errors = { decode: jest.fn(async () => ({ code: '82000', message: 'Liquidité insuffisante' })) };
    const glossary = { findByTerm: jest.fn(async () => ({ term: 'wallet', domainContext: 'WALLET', localizedMappings: new Map([['fr', 'portefeuille']]) })) };
    const service = new McpServerService(
      { get: jest.fn() } as never, translation as never, errors as never, glossary as never,
      { increment: jest.fn() } as never, { consumeRateLimit: jest.fn() } as never,
    );
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'contract-test', version: '1.0.0' });
    const server = service.createServer();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(['translate_text', 'decode_error', 'glossary_lookup']);
    const result = await client.callTool({ name: 'translate_text', arguments: { text: 'Connect your wallet', targetLanguage: 'fr' } });
    expect(result.content).toEqual([{ type: 'text', text: 'Connectez votre portefeuille' }]);
    await client.close();
    await server.close();
  });
});
