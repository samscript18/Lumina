import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { TranslationService } from '../translation/translation.service';
import { ErrorInterpreterService } from '../error-interpreter/error-interpreter.service';
import { Web3GlossaryRepository } from '../database/repositories/web3-glossary.repository';
import { MetricsService } from '../metrics/metrics.service';
import { RedisService } from '../cache/redis.service';

/**
 * Exposes Lumina as an MCP server so third-party autonomous agents (including
 * OKX.AI agents) can call translate_text(), decode_error(), and
 * glossary_lookup() programmatically, over SSE (GET /sse to open the stream,
 * POST /messages to send tool calls — standard MCP-over-HTTP pattern).
 */
@Injectable()
export class McpServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpServerService.name);
  private httpServer?: http.Server;
  private readonly transportsBySession = new Map<string, SSEServerTransport>();
  private readonly streamableTransports = new Map<string, StreamableHTTPServerTransport>();

  constructor(
    private readonly config: ConfigService,
    private readonly translationService: TranslationService,
    private readonly errorInterpreterService: ErrorInterpreterService,
    private readonly glossaryRepo: Web3GlossaryRepository,
    private readonly metrics: MetricsService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    if (!this.config.get<boolean>('mcpHttpEnabled')) return;
    const port = this.config.get<number>('mcpHttpPort') ?? 3100;

    this.httpServer = http.createServer(async (req, res) => {
      try {
        const authorized = this.authorize(req);
        const withinLimit = authorized ? await this.withinRateLimit(req) : false;
        if (!authorized || !withinLimit) {
          res.writeHead(!authorized ? 401 : 429).end(!authorized ? 'Unauthorized' : 'Rate limit exceeded');
          return;
        }
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        if (url.pathname === '/mcp' && ['GET', 'POST', 'DELETE'].includes(req.method ?? '')) {
          const raw = await this.readBody(req);
          const body = raw.length ? JSON.parse(raw.toString('utf8')) : undefined;
          const sessionId = typeof req.headers['mcp-session-id'] === 'string' ? req.headers['mcp-session-id'] : undefined;
          let transport = sessionId ? this.streamableTransports.get(sessionId) : undefined;
          if (!transport && req.method === 'POST' && isInitializeRequest(body)) {
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: randomUUID,
              onsessioninitialized: (id) => { this.streamableTransports.set(id, transport!); },
            });
            transport.onclose = () => {
              if (transport?.sessionId) this.streamableTransports.delete(transport.sessionId);
            };
            await this.createServer().connect(transport);
          }
          if (!transport) {
            res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Missing or invalid MCP session' }, id: null }));
            return;
          }
          await transport.handleRequest(req as never, res as never, body);
          return;
        }

        if (req.method === 'GET' && url.pathname === '/sse') {
          const transport = new SSEServerTransport('/messages', res);
          this.transportsBySession.set(transport.sessionId, transport);
          res.on('close', () => this.transportsBySession.delete(transport.sessionId));
          await this.createServer().connect(transport);
          return;
        }

        if (req.method === 'POST' && url.pathname === '/messages') {
        const sessionId = url.searchParams.get('sessionId');
        const transport = sessionId ? this.transportsBySession.get(sessionId) : undefined;
        if (!transport) {
          res.writeHead(400).end('Unknown or missing sessionId. Open /sse first.');
          return;
        }
        const raw = await this.readBody(req);
        const body = raw.length ? JSON.parse(raw.toString('utf8')) : undefined;
        await transport.handlePostMessage(req, res, body);
        return;
        }

        res.writeHead(404).end('Not found. Use GET /sse then POST /messages?sessionId=...');
      } catch (error) {
        this.logger.error(error instanceof Error ? error.stack : String(error));
        if (!res.headersSent) res.writeHead(400).end('Invalid MCP request');
      }
    });

    this.httpServer.listen(port, () => {
      this.logger.log(`MCP server listening on port ${port} (SSE transport: GET /sse, POST /messages)`);
    });
  }

  onModuleDestroy() {
    this.httpServer?.close();
  }

  async connectStdio(): Promise<void> {
    await this.createServer().connect(new StdioServerTransport());
  }

  private authorize(req: http.IncomingMessage): boolean {
    const allowedHosts = this.config.get<string[]>('mcpAllowedHosts') ?? [];
    const host = (req.headers.host ?? '').split(':')[0]!.toLowerCase();
    if (allowedHosts.length > 0 && !allowedHosts.includes(host)) return false;
    if (allowedHosts.length === 0 && this.config.get<string>('nodeEnv') === 'production') return false;
    const value = this.config.get<string[]>('apiKeys');
    const keys = Array.isArray(value) ? value : [];
    const fallback = this.config.get<string>('apiKey');
    const configured = keys.length > 0 ? keys : fallback ? [fallback] : [];
    if (configured.length === 0) return this.config.get<string>('nodeEnv') !== 'production';
    const provided = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!provided) return false;
    return configured.some((key) => {
      const expected = Buffer.from(key);
      const actual = Buffer.from(provided);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    });
  }

  private async withinRateLimit(req: http.IncomingMessage): Promise<boolean> {
    const id = req.headers.authorization ?? req.socket.remoteAddress ?? 'unknown';
    return (await this.redis.consumeRateLimit(`mcp:${RedisService.hashKey(id, 'client')}`, 120, 60)).allowed;
  }

  private async readBody(req: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let size = 0;
    const maximum = this.config.get<number>('maxPayloadBytes') ?? 1_048_576;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > maximum) throw new Error('Payload too large');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  createServer(): Server {
    const server = new Server(
      { name: 'lumina', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'translate_text',
          description:
            'Translate a piece of UI/dApp copy into a target language using Web3-aware semantic translation, with variables/placeholders/tickers automatically protected.',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The source text to translate' },
              targetLanguage: { type: 'string', description: 'Target language, e.g. "pt-BR", "zh-CN", "fr"' },
            },
            required: ['text', 'targetLanguage'],
          },
        },
        {
          name: 'decode_error',
          description:
            'Decode a raw OKX OnchainOS execution error code (Swap API or Transaction API) into a plain-language, localized, actionable explanation.',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string', description: 'OKX OnchainOS error code, e.g. "82000" (insufficient liquidity), "81104" (chain not supported)' },
              targetLanguage: { type: 'string', description: 'Target language code, defaults to "en"' },
            },
            required: ['code'],
          },
        },
        {
          name: 'glossary_lookup',
          description: 'Look up a Web3/DeFi term in the Lumina glossary, including any verified localized mappings.',
          inputSchema: {
            type: 'object',
            properties: {
              term: { type: 'string', description: 'Web3 term to look up, e.g. "wallet", "slippage", "liquidity pool"' },
            },
            required: ['term'],
          },
        },
      ],
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        this.metrics.increment('mcp_calls_total');
        switch (name) {
          case 'translate_text': {
            const { text, targetLanguage } = z.object({ text: z.string().min(1).max(100_000), targetLanguage: z.string().min(2).max(35) }).parse(args);
            const translated = await this.translationService.translateString(text, targetLanguage);
            return { content: [{ type: 'text', text: translated }] };
          }
          case 'decode_error': {
            const { code, targetLanguage } = z.object({ code: z.string().min(1).max(256), targetLanguage: z.string().min(2).max(35).optional() }).parse(args);
            const decoded = await this.errorInterpreterService.decode(code, targetLanguage ?? 'en');
            return { content: [{ type: 'text', text: JSON.stringify(decoded) }] };
          }
          case 'glossary_lookup': {
            const { term } = z.object({ term: z.string().min(1).max(128) }).parse(args);
            const entry = await this.glossaryRepo.findByTerm(term);
            if (!entry) {
              return { content: [{ type: 'text', text: `No glossary entry found for "${term}"` }], isError: true };
            }
            const payload = {
              term: entry.term,
              domainContext: entry.domainContext,
              localizedMappings: Object.fromEntries(entry.localizedMappings ?? new Map()),
            };
            return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
          }
          default:
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }
      } catch (err) {
        this.logger.error(`Tool "${name}" failed: ${(err as Error).message}`);
        return { content: [{ type: 'text', text: (err as Error).message }], isError: true };
      }
    });

    return server;
  }
}
