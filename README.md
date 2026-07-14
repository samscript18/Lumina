# Lumina

A Web3 semantic localization middleware that translates dApp localization files while preserving code integrity, integrating into GitHub workflows, and exposing translation services through MCP. Built for the OKX.AI Genesis Hackathon.

## Architecture

8 modules, each independently testable, composed by `TranslationService` into one pipeline:

```
Context Parser → Immutability Guard → Semantic Engine → Validator → (unshield) → Cache write-through
```

| # | Module | Location |
|---|--------|----------|
| 1 | Context Parser | `src/parser` |
| 2 | Immutability Guard | `src/shield` |
| 3 | Semantic Translation Engine | `src/semantic` |
| 4 | Translation Validator | `src/validator` |
| 5 | GitOps Automation | `src/gitops` |
| 6 | Redis Cache | `src/cache` |
| 7 | Onchain Error Interpreter | `src/error-interpreter` |
| 8 | MCP Server | `src/mcp` |

Persistence (Mongo schemas/repositories for the translation cache and Web3 glossary) lives in `src/database`.

## How Web3 applications and agents use Lumina

Lumina exposes one deployed service through three integration surfaces:

1. **AI agents — MCP Streamable HTTP:** connect to `https://api.example.com/mcp` with a bearer key, discover `translate_text`, `decode_error`, and `glossary_lookup`, and call them without a custom protocol adapter. This is the preferred OKX.AI integration.
2. **dApp backends — REST:** call the versioned `/api/v1` endpoints from a trusted server. Never embed `LUMINA_API_KEY` in public browser JavaScript.
3. **GitHub automation:** send signed push events to `/api/v1/webhooks/github`. Lumina discovers changed source-locale files, generates localized artifacts, and opens a pull request.

Interactive Swagger/OpenAPI documentation is served at `/docs`.

## Setup

```bash
cp .env.example .env   # fill in LLM_API_KEY (or GROQ_API_KEY) + MONGODB_URI + REDIS_URL at minimum
npm install
npm run verify:live    # confirms Mongo/Redis/LLM are all actually reachable before you go further
npm run seed:glossary  # populate starter Web3 glossary terms
npm run start:dev
```

Requires a running MongoDB (`MONGODB_URI`) and Redis (`REDIS_URL` for TLS providers like Upstash, or discrete `REDIS_HOST`/`REDIS_PORT`) instance. The LLM provider is configured via `LLM_BASE_URL` / `LLM_API_KEY` (or `GROQ_API_KEY` as an alias) / `LLM_MODEL` and is provider-agnostic — any OpenAI-compatible `/chat/completions` endpoint works.

Set `LUMINA_API_KEY` before deploying anywhere reachable by the public. In `NODE_ENV=production`, protected REST routes and MCP HTTP reject all traffic until it is configured. Development remains open when the key is unset.

Production also requires `MCP_ALLOWED_HOSTS` and an explicit `CORS_ORIGINS` allowlist when browser access is needed.

## REST API (prefix `/api/v1`)

- `POST /translate/string` — `{ text, targetLanguage }` → `{ translated }`
- `POST /translate/file` — `{ content, format: 'json'|'ts-i18n'|'js-i18n', targetLanguage }` → translated file + pipeline stats
- `POST /webhooks/git-sync` — GitOps entry point; diffs and translates only changed strings across one or more files/languages
- `POST /webhooks/github` — native signed GitHub push webhook; does not require the bearer key
- `POST /decode-error` — `{ code, targetLanguage? }` → plain-language, localized onchain error explanation
- `GET /glossary?term=...` or `?domainContext=...` — glossary lookup/listing
- `GET /metrics` — authenticated, process-local operational counters
- `GET /health` — unauthenticated health check (outside the `/api/v1` prefix)
- `GET /health/ready` — MongoDB/Redis readiness probe

REST successes use `{ "success": true, "data": ... }`; failures use `{ "success": false, "error": { "statusCode", "code", "message" }, "timestamp" }`.

## MCP Server

The preferred Streamable HTTP endpoint is `/mcp` (`POST`/`GET`/`DELETE`) on the same public NestJS port as REST and Swagger, which makes Cloud Run and reverse-proxy deployment seamless. Set `MCP_HTTP_ENABLED=false` in production to disable the optional separate legacy server. Local legacy SSE remains available on `MCP_HTTP_PORT` through `GET /sse` and `POST /messages?sessionId=...` when that server is enabled.

- `translate_text(text, targetLanguage)`
- `decode_error(code, targetLanguage?)`
- `glossary_lookup(term)`

This is the primary integration point for OKX.AI agents.

```json
{
  "mcpServers": {
    "lumina": {
      "type": "streamable-http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer ${LUMINA_API_KEY}" }
    }
  }
}
```

For local MCP clients that use stdio:

```bash
npm run build
npm run start:mcp:stdio
```

## Design notes

- **Provider-agnostic LLM client** (`src/semantic/llm-client.service.ts`): swapping LLM vendors is an env-var change, not a code change.
- **Two-tier cache**: Redis for hot-path latency, MongoDB `TranslationCache` for durability across Redis restarts/eviction — both keyed on `MD5(sourceText::targetLanguage)`. `RedisService` accepts either a full `REDIS_URL` connection string (required for TLS providers like Upstash) or discrete host/port/password.
- **Stampede protection**: a Redis distributed lock ensures concurrent identical cache misses produce one LLM request.
- **Distributed rate limiting**: REST and MCP budgets are coordinated through Redis across replicas.
- **Fail loudly, not silently**: a dropped placeholder token or a malformed LLM response triggers one corrective retry, then a hard error — Lumina never ships a translation it can't verify.
- **TS/JS i18n parsing** uses the TypeScript AST and accepts static object/array/scalar literals only. Repository code is never evaluated; dynamic expressions, spreads, getters, computed keys, and prototype-sensitive keys are rejected.
- **Key-path GitOps diffing**: `GitopsService` compares previous/current values by structural key path. Include `previousTranslatedContent: { "fr": "..." }` for each file to reuse unchanged localized values and translate only changed/new paths. Without a prior localized artifact, Lumina deliberately performs one complete translation so it never emits a mixed-language file.
- **API key auth**: `ApiKeyGuard` gates the billable endpoints (`/translate/*`, `/decode-error`, `/webhooks/git-sync`) behind `LUMINA_API_KEY` when set; a no-op locally if unset.
- **Global exception filter**: every unhandled error is normalized to a clean JSON error response server-side; stack traces are logged, never returned to callers.

## Production checks

```bash
npm run check
npm audit --omit=dev
npm run verify:live
```

The automated suite covers parser extraction/lossless no-op round trips, adversarial nested shielding, validator rejection, corrective retry, no-persist-on-failure, key-path GitOps deltas, authentication, and Onchain/EVM error lookup. `verify:live` remains mandatory in the deployment environment because it exercises real MongoDB, Redis, and LLM credentials.

Mongo indexes are created and inspected at startup; startup fails if the required unique `stringHash` or glossary `term` index is missing. Translation metrics report only observed process counters—no estimated cost or fabricated performance numbers.

Authenticated Prometheus-format metrics are served at `/api/v1/metrics/prometheus`; JSON counters remain available at `/api/v1/metrics`.

## GitHub automation

Create a fine-grained GitHub token restricted to the repositories Lumina manages, with **Contents: read/write** and **Pull requests: read/write**. Configure `GITHUB_TOKEN`, `GITHUB_TARGET_LANGUAGES`, and `GITHUB_SOURCE_LOCALE`.

Configure the repository webhook as follows:

- Payload URL: `https://api.example.com/api/v1/webhooks/github`
- Content type: `application/json`
- Secret: the exact `GIT_WEBHOOK_SECRET`
- SSL verification: enabled
- Event: push only

Deliveries are deduplicated using `X-GitHub-Delivery`. Generated changes always go through a pull request; Lumina never writes directly to the default branch.

## Container deployment

`Dockerfile` builds a non-root production image. For a local production-shaped stack:

```bash
cp .env.example .env
# Set LUMINA_API_KEY and LLM_API_KEY in .env
docker compose up --build
```

Do not use plain `docker compose config` with a populated `.env`, because Docker renders environment values into terminal output. If configuration inspection is necessary, use `docker compose config --no-env-resolution` and review the output before sharing it.

Terminate TLS at the deployment load balancer or reverse proxy. Do not expose MongoDB or Redis publicly.
