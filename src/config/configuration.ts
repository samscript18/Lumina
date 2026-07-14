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
  llm: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  mcpHttpPort: number;
  mcpHttpEnabled: boolean;
  gitWebhookSecret?: string;
  /** If set, all /translate and /decode-error calls require Authorization: Bearer <apiKey> */
  apiKey?: string;
  okx: {
    apiKey?: string;
    apiSecret?: string;
    passphrase?: string;
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
  llm: {
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
    apiKey: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || '',
    model: process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile',
  },
  mcpHttpPort: parseInt(process.env.MCP_HTTP_PORT ?? '3100', 10),
  mcpHttpEnabled: process.env.MCP_HTTP_ENABLED !== 'false',
  gitWebhookSecret: process.env.GIT_WEBHOOK_SECRET || undefined,
  apiKey: process.env.LUMINA_API_KEY || undefined,
  okx: {
    apiKey: process.env.OKX_API_KEY || undefined,
    apiSecret: process.env.OKX_API_SECRET || undefined,
    passphrase: process.env.OKX_API_PASSPHRASE || undefined,
  },
});
