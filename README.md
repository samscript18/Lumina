# Lumina

**Web3-native semantic localization and onchain error intelligence for dApps and AI agents.**

Lumina translates interface copy and localization files without corrupting placeholders, code fragments, token symbols, wallet addresses, or Web3 terminology. It also turns raw OKX/EVM errors into localized, actionable explanations and exposes the same capabilities through a TypeScript SDK, REST, MCP, and GitHub automation.

[Live API](https://lumina-e3vi.onrender.com/health) · [Swagger](https://lumina-e3vi.onrender.com/docs) · [Mintlify documentation](https://samscript.mintlify.app/) · [TypeScript SDK](https://www.npmjs.com/package/@lumina-ai/sdk) · [GitHub](https://github.com/samscript18/Lumina)

## What Lumina provides

- **Protected localization:** shields variables, ICU-style placeholders, HTML, URLs, addresses, code, and token symbols before translation, then restores them exactly.
- **Web3-aware meaning:** applies glossary context so protocol and financial terminology is translated consistently.
- **Validated output:** rejects malformed structure, missing keys, damaged placeholders, and unsafe model output before it reaches users.
- **Onchain error intelligence:** decodes known OKX/EVM errors locally and can localize the explanation through the semantic pipeline.
- **GitOps localization:** processes signed GitHub push events, translates changed locale content, commits generated files to a branch, and opens a reviewable pull request.
- **Agent-native access:** exposes Streamable HTTP MCP tools for direct use by AI agents and the OKX.AI ecosystem.
- **Production access control:** supports a bootstrap environment key plus hashed, scoped, expiring, rotatable consumer credentials.

## Current deployment

| Surface | Address |
|---|---|
| Production API | `https://lumina-e3vi.onrender.com` |
| Swagger/OpenAPI | `https://lumina-e3vi.onrender.com/docs` |
| MCP | `https://lumina-e3vi.onrender.com/mcp` |
| Mintlify docs | `https://samscript.mintlify.app/` |
| npm package | `@lumina-ai/sdk` |
| OKX.AI identity | Lumina ASP `#5891` |

The Render service is the only production deployment described by this repository. MongoDB and Redis are required dependencies; the LLM layer accepts any OpenAI-compatible `/chat/completions` provider.

## Architecture

```text
Request
  -> authentication + distributed rate limit
  -> context parser
  -> immutability shield
  -> semantic translation engine
  -> structural and placeholder validator
  -> token restoration
  -> Redis/MongoDB cache
  -> REST, SDK, MCP, or GitOps response
```

| Module | Responsibility | Location |
|---|---|---|
| Access | Scoped API credentials and administration | `src/access` |
| Parser | JSON and static TypeScript/JavaScript i18n parsing | `src/parser` |
| Shield | Immutable token detection and restoration | `src/shield` |
| Semantic engine | Provider-agnostic LLM translation | `src/semantic` |
| Validator | Structural and placeholder integrity checks | `src/validator` |
| Cache | Redis hot cache and distributed locking | `src/cache` |
| Database | Durable translations, glossary, and credentials | `src/database` |
| GitOps | Explicit sync requests and GitHub pull requests | `src/gitops` |
| Error interpreter | Static decoding and live OKX quotes | `src/error-interpreter` |
| MCP | Streamable HTTP, legacy SSE, and stdio transports | `src/mcp` |
| Metrics | JSON and Prometheus counters | `src/metrics` |

Lumina remains a NestJS, TypeScript, MongoDB, and Redis application. No alternate backend framework or database is required.

## Integration options

| Consumer | Recommended interface | Why |
|---|---|---|
| NestJS/Node.js backend | TypeScript SDK | Typed methods, timeouts, cancellation, request IDs, and normalized errors |
| AI agent or OKX.AI ASP | MCP | Tool discovery and structured calls without a custom adapter |
| Any trusted backend | REST | Stable, versioned HTTP contract with Swagger |
| GitHub repository | Signed webhook | Automatic locale updates through pull requests |

Long-lived Lumina keys belong in a backend, worker, server action, or agent secret store. Never include them in public browser bundles.

## TypeScript SDK quickstart

The public SDK supports Node.js 20+, ESM, and CommonJS with no runtime dependencies.

```bash
npm install @lumina-ai/sdk
```

```ts
import { LuminaClient } from '@lumina-ai/sdk';

const lumina = new LuminaClient({
  apiKey: process.env.LUMINA_API_KEY!,
});

const result = await lumina.translateText({
  text: 'Swap {amount} ETH from {{wallet}}',
  targetLanguage: 'pt-BR',
});

console.log(result.translated);
```

Available methods are `translateText`, `translateFile`, `decodeError`, `getQuote`, `glossary`, `metrics`, and `mcpServerConfig`. See the [SDK guide](https://samscript.mintlify.app/docs/typescript-sdk) for error handling and the [KeetaPay integration](https://samscript.mintlify.app/docs/integrations/keetapay) for a production NestJS example.

## REST quickstart

All billable and operational routes require a bearer key in production.

```bash
export LUMINA_API_KEY="your-consumer-key"

curl https://lumina-e3vi.onrender.com/api/v1/translate/string \
  -H "Authorization: Bearer $LUMINA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Swap {amount} ETH from {{wallet}}","targetLanguage":"fr"}'
```

Successful REST calls use:

```json
{ "success": true, "data": {} }
```

Failures use:

```json
{
  "success": false,
  "error": { "statusCode": 400, "code": "VALIDATION_ERROR", "message": "..." },
  "timestamp": "..."
}
```

### API routes

| Method | Route | Scope | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/translate/string` | `translate` | Translate one protected string |
| `POST` | `/api/v1/translate/file` | `translate` | Translate JSON or static TS/JS i18n content |
| `POST` | `/api/v1/decode-error` | `decode` | Decode and optionally localize an OKX/EVM error |
| `POST` | `/api/v1/onchain/quote` | `quote` | Request a live OKX OnchainOS swap quote |
| `GET` | `/api/v1/glossary` | `glossary` | Look up a term or list entries by domain context |
| `POST` | `/api/v1/webhooks/git-sync` | `gitops` | Translate an explicitly supplied localization tree |
| `POST` | `/api/v1/webhooks/github` | GitHub signature | Process a native push event and open a localization PR |
| `GET` | `/api/v1/metrics` | `metrics` | Return JSON process counters |
| `GET` | `/api/v1/metrics/prometheus` | `metrics` | Return Prometheus-format counters |
| `GET/POST/DELETE` | `/mcp` | `mcp` or x402 | Streamable HTTP MCP transport |
| `GET` | `/health` | Public | Liveness probe |
| `GET` | `/health/ready` | Public | MongoDB and Redis readiness probe |

The administration routes under `/api/v1/admin/api-keys` require the `admin` scope and support listing, creation, rotation, and revocation. Full schemas and examples are available in [Swagger](https://lumina-e3vi.onrender.com/docs).

## MCP for AI agents

Lumina exposes these tools:

- `translate_text(text, targetLanguage)`
- `decode_error(code, targetLanguage?)`
- `glossary_lookup(term)`

Streamable HTTP configuration:

```json
{
  "mcpServers": {
    "lumina": {
      "type": "streamable-http",
      "url": "https://lumina-e3vi.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer ${LUMINA_API_KEY}"
      }
    }
  }
}
```

Lumina supports two server-side access paths on the same MCP endpoint:

- Existing consumers can send a scoped bearer key.
- Marketplace callers without a bearer key receive a standard x402 v2 `402 Payment Required` challenge, pay on X Layer, and replay the request. The successful response includes settlement proof.

Production payment mode uses `X402_ENABLED`, `X402_NETWORK`, `X402_PRICE_USD`, `X402_PAY_TO_ADDRESS`, and `X402_RESOURCE_URL`. It is implemented with the official OKX payment packages; payment verification is never inferred from a client-controlled header.

For a local stdio client:

```bash
npm run build
npm run start:mcp:stdio
```

The separate legacy HTTP/SSE server is optional. Disable it with `MCP_HTTP_ENABLED=false` when using the same-port `/mcp` endpoint, as on Render.

## Languages

Lumina does not maintain a hardcoded finite language list. Translation routes accept standard two- or three-letter language codes with an optional regional/script subtag, such as `fr`, `pt-BR`, or `zh-CN`. Actual fluency depends on the configured LLM and available glossary context.

The default GitHub automation targets `pt-BR`, `zh-CN`, and `fr`; change `GITHUB_TARGET_LANGUAGES` to configure a different comma-separated set. Those defaults are deployment choices, not Lumina's language limit.

## API keys and scopes

Production supports two credential layers:

1. `LUMINA_API_KEY` or `LUMINA_API_KEYS` provides bootstrap administration access and carries all scopes.
2. Consumer keys are generated through `/api/v1/admin/api-keys`, stored only as SHA-256 hashes, and assigned the minimum required scopes.

Available scopes are `translate`, `decode`, `quote`, `glossary`, `metrics`, `mcp`, `gitops`, and `admin`. Plaintext consumer keys are returned once at creation or rotation; store them immediately in the consumer's deployment secret manager.

A verified x402 payment grants only the `mcp` scope for that request. It cannot access REST, metrics, GitOps, or administration routes.

## Local development

Requirements: Node.js 22 for the application toolchain, MongoDB, and Redis.

```bash
npm install
cp .env.example .env
# Fill in MongoDB, Redis, LLM, and security values.
npm run verify:live
npm run seed:glossary
npm run start:dev
```

NestJS loads `.env` for direct local commands. Docker Compose uses `.env.local` by default:

```bash
cp .env.example .env.local
docker compose up --build
```

Use either `REDIS_URL`—including `rediss://` for TLS providers such as Upstash—or the discrete `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD` values. `REDIS_URL` takes precedence.

The LLM client is configured with `LLM_BASE_URL`, `LLM_API_KEY` (or `GROQ_API_KEY`), and `LLM_MODEL`. Changing providers is an environment update when the provider supports OpenAI-compatible chat completions.

## GitHub localization automation

Configure a fine-grained GitHub token for each managed repository with:

- **Contents:** read and write
- **Pull requests:** read and write

Set `GITHUB_TOKEN`, `GITHUB_TARGET_LANGUAGES`, `GITHUB_SOURCE_LOCALE`, `GITHUB_OUTPUT_DIRECTORY`, and `GIT_WEBHOOK_SECRET`. Then create a push-only webhook:

| GitHub setting | Value |
|---|---|
| Payload URL | `https://lumina-e3vi.onrender.com/api/v1/webhooks/github` |
| Content type | `application/json` |
| Secret | Exact value of `GIT_WEBHOOK_SECRET` |
| SSL verification | Enabled |
| Events | Push only |

Deliveries are deduplicated with `X-GitHub-Delivery`. Lumina writes generated locale files to a branch and opens a pull request; it does not push directly to a protected default branch.

## Production verification

```bash
npm run check
npm audit --omit=dev
npm run sdk:pack
npm run docs:validate
npm run verify:live
npm run verify:production
```

- `check` runs linting, TypeScript checking, tests, and production builds.
- `verify:live` tests real MongoDB, Redis, and LLM credentials.
- `verify:production` probes the deployed health, readiness, Swagger, REST authentication, and MCP surfaces.
- The production probe also validates the unpaid x402 v2 challenge, X Layer network, receiving address, positive amount, and advertised resource URL.
- CI also builds the Docker image and scans application dependencies, the filesystem, and the container for high/critical vulnerabilities.

The production image runs as a non-root user with a readiness health check. Docker Compose additionally uses a read-only application filesystem, a temporary `/tmp`, and `no-new-privileges`.

## Reliability and safety

- Redis distributed locks prevent translation-cache stampedes across replicas.
- MongoDB provides durable cache fallback when Redis entries expire or are evicted.
- Static TypeScript/JavaScript locale parsing never evaluates repository code.
- Dynamic expressions, getters, spreads, computed keys, and prototype-sensitive keys are rejected.
- A failed placeholder or structural validation receives one corrective model retry, then fails loudly.
- Request payloads, outbound calls, and distributed rate limits are bounded.
- Stack traces remain server-side; clients receive normalized error envelopes.
- Required MongoDB indexes are verified during startup.

## Documentation

- [How Lumina works](https://samscript.mintlify.app/docs/how-lumina-works)
- [Quickstart](https://samscript.mintlify.app/docs/quickstart)
- [REST API](https://samscript.mintlify.app/docs/rest-api)
- [MCP integration](https://samscript.mintlify.app/docs/mcp)
- [GitHub GitOps](https://samscript.mintlify.app/docs/github-gitops)
- [TypeScript SDK](https://samscript.mintlify.app/docs/typescript-sdk)

## License

MIT
