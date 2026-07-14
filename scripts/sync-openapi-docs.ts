import { writeFile } from 'fs/promises';

async function main() {
  const source = process.env.OPENAPI_SOURCE_URL ?? 'https://lumina-e3vi.onrender.com/docs-json';
  const response = await fetch(source, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`OpenAPI source returned HTTP ${response.status}`);
  const document = await response.json() as { paths?: Record<string, unknown>; servers?: { url: string; description?: string }[] };
  if (!document.paths || !document.paths['/api/v1/translate/string']) throw new Error('OpenAPI source is missing required Lumina operations');
  // MCP Streamable HTTP is a JSON-RPC transport, not a REST operation. Nest's
  // @All decorator can appear as a synthetic SEARCH method, which is invalid
  // in OpenAPI and must never enter Mintlify's REST reference.
  delete document.paths['/mcp'];
  document.servers = [{ url: 'https://lumina-e3vi.onrender.com', description: 'Production' }];
  await writeFile('openapi.json', `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`OpenAPI documentation synchronized from ${source}`);
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
