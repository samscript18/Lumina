import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });

const baseUrl = (process.env.LUMINA_BASE_URL ?? 'https://lumina-e3vi.onrender.com').replace(/\/$/, '');
const apiKey = process.env.LUMINA_API_KEY;
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 30_000);

async function request(name: string, path: string, init: RequestInit = {}, expected = [200, 201]) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!expected.includes(response.status)) throw new Error(`${name} returned HTTP ${response.status}`);
  console.log(`${name}: ${response.status}`);
  return response;
}

async function alert(message: string): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `Lumina production smoke failed: ${message}` }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

function parseMcpResponse(body: string): { result?: { tools?: { name: string }[] } } {
  const data = body.split('\n').find((line) => line.startsWith('data: '))?.slice(6) ?? body;
  return JSON.parse(data) as { result?: { tools?: { name: string }[] } };
}

async function probeMcp(apiKey: string): Promise<void> {
  const headers = {
    authorization: `Bearer ${apiKey}`,
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };
  const initialize = await request('mcp initialize', '/mcp', {
    method: 'POST', headers,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'lumina-production-monitor', version: '1.0.0' } },
    }),
  });
  parseMcpResponse(await initialize.text());
  const sessionId = initialize.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('MCP initialize did not return a session ID');
  const sessionHeaders = { ...headers, 'mcp-session-id': sessionId };
  await request('mcp initialized notification', '/mcp', {
    method: 'POST', headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  }, [200, 202]);
  const listed = await request('mcp tool discovery', '/mcp', {
    method: 'POST', headers: sessionHeaders,
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  });
  const tools = parseMcpResponse(await listed.text()).result?.tools ?? [];
  const expectedTools = ['translate_text', 'decode_error', 'glossary_lookup'];
  const discovered = new Set(tools.map((tool) => tool.name));
  for (const tool of expectedTools) {
    if (!discovered.has(tool)) throw new Error(`MCP tool discovery is missing ${tool}`);
  }
  console.log(`mcp tools: ${expectedTools.join(', ')}`);
  await request('mcp session close', '/mcp', { method: 'DELETE', headers: sessionHeaders }, [200, 204]);
}

async function main() {
  const health = await (await request('health', '/health')).json() as { data?: { status?: string } };
  if (health.data?.status !== 'ok') throw new Error('Health payload is not ok');
  const ready = await (await request('readiness', '/health/ready')).json() as { data?: { status?: string } };
  if (ready.data?.status !== 'ready') throw new Error('Readiness payload is not ready');
  await request('swagger', '/docs');
  const openapi = await (await request('openapi', '/docs-json')).json() as { paths?: Record<string, unknown> };
  for (const path of ['/api/v1/translate/string', '/api/v1/decode-error', '/api/v1/webhooks/github']) {
    if (!openapi.paths?.[path]) throw new Error(`OpenAPI is missing ${path}`);
  }
  if (apiKey) {
    const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
    await request('unauthenticated REST rejection', '/api/v1/glossary?term=wallet', {}, [401]);
    await request('invalid bearer rejection', '/api/v1/glossary?term=wallet', {
      headers: { authorization: 'Bearer lumina_invalid_production_probe' },
    }, [401]);
    await request('authenticated glossary', '/api/v1/glossary?term=wallet', { headers });
    const translated = await (await request('translation', '/api/v1/translate/string', {
      method: 'POST', headers,
      body: JSON.stringify({ text: 'Monitor {amount} ETH', targetLanguage: 'fr' }),
    })).json() as { data?: { translated?: string } };
    if (!translated.data?.translated?.includes('{amount}') || !translated.data.translated.includes('ETH')) {
      throw new Error('Translation token integrity failed');
    }

    await probeMcp(apiKey);
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  await alert(message);
  process.exit(1);
});
