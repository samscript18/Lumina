export interface LuminaConfig {
  port: number;
  nodeEnv: string;
  mongodbUri: string;
  redisUrl?: string;
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  cacheTtlSeconds: number;
  maxPayloadBytes: number;
  requestTimeoutMs: number;
  corsOrigins: string[];
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  mcpHttpPort: number;
  mcpHttpEnabled: boolean;
  mcpAllowedHosts: string[];
  gitWebhookSecret?: string;
  github: {
    token?: string;
    targetLanguages: string[];
    sourceLocale: string;
    outputDirectory: string;
  };
  /** If set, all /translate and /decode-error calls require Authorization: Bearer <apiKey> */
  apiKey?: string;
  apiKeys: string[];
  okx: {
    apiKey?: string;
    apiSecret?: string;
    passphrase?: string;
  };
  x402: {
    enabled: boolean;
    network: string;
    price: string;
    payToAddress?: string;
    resourceUrl: string;
  };
}

export default (): LuminaConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/lumina',
  redisUrl: process.env.REDIS_URL || undefined,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  cacheTtlSeconds: parseInt(process.env.TRANSLATION_CACHE_TTL_SECONDS ?? '2592000', 10),
  maxPayloadBytes: parseInt(process.env.MAX_PAYLOAD_BYTES ?? '1048576', 10),
  requestTimeoutMs: parseInt(process.env.OUTBOUND_REQUEST_TIMEOUT_MS ?? '15000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
    apiKey: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
    model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
  },
  mcpHttpPort: parseInt(process.env.MCP_HTTP_PORT ?? '3100', 10),
  mcpHttpEnabled: process.env.MCP_HTTP_ENABLED !== 'false',
  mcpAllowedHosts: (process.env.MCP_ALLOWED_HOSTS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean),
  gitWebhookSecret: process.env.GIT_WEBHOOK_SECRET || undefined,
  github: {
    token: process.env.GITHUB_TOKEN || undefined,
    targetLanguages: (process.env.GITHUB_TARGET_LANGUAGES ?? 'pt-BR,zh-CN,fr').split(',').map((value) => value.trim()).filter(Boolean),
    sourceLocale: process.env.GITHUB_SOURCE_LOCALE ?? 'en',
    outputDirectory: process.env.GITHUB_OUTPUT_DIRECTORY ?? 'locales',
  },
  apiKey: process.env.LUMINA_API_KEY || undefined,
  apiKeys: (process.env.LUMINA_API_KEYS ?? process.env.LUMINA_API_KEY ?? '').split(',').map((value) => value.trim()).filter(Boolean),
  okx: {
    apiKey: process.env.OKX_API_KEY || undefined,
    apiSecret: process.env.OKX_API_SECRET || undefined,
    passphrase: process.env.OKX_API_PASSPHRASE || undefined,
  },
  x402: {
    enabled: process.env.X402_ENABLED === 'true',
    network: process.env.X402_NETWORK ?? 'eip155:196',
    price: process.env.X402_PRICE_USD ?? '$0.01',
    payToAddress: process.env.X402_PAY_TO_ADDRESS || undefined,
    resourceUrl: process.env.X402_RESOURCE_URL ?? 'https://lumina-e3vi.onrender.com/mcp',
  },
});

export function validateEnvironment(environment: Record<string, unknown>): Record<string, unknown> {
  if (environment.NODE_ENV !== 'production') return environment;
  const required = [
    'MONGODB_URI', 'MCP_ALLOWED_HOSTS',
    'GIT_WEBHOOK_SECRET', 'GITHUB_TOKEN', 'OKX_API_KEY', 'OKX_API_SECRET', 'OKX_API_PASSPHRASE',
  ];
  const missing = required.filter((key) => typeof environment[key] !== 'string' || !(environment[key] as string).trim());
  if (!String(environment.REDIS_URL ?? environment.REDIS_HOST ?? '').trim()) missing.push('REDIS_URL');
  if (!String(environment.LLM_API_KEY ?? environment.GROQ_API_KEY ?? '').trim()) missing.push('LLM_API_KEY');
  if (!String(environment.LUMINA_API_KEYS ?? environment.LUMINA_API_KEY ?? '').trim()) missing.push('LUMINA_API_KEY');
  if (environment.X402_ENABLED === 'true' && !String(environment.X402_PAY_TO_ADDRESS ?? '').trim()) {
    missing.push('X402_PAY_TO_ADDRESS');
  }
  if (missing.length > 0) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  return environment;
}
