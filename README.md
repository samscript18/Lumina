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

## REST API (prefix `/api/v1`)

- `POST /translate/string` — `{ text, targetLanguage }` → `{ translated }`
- `POST /translate/file` — `{ content, format: 'json'|'ts-i18n'|'js-i18n', targetLanguage }` → translated file + pipeline stats
- `POST /webhooks/git-sync` — GitOps entry point; diffs and translates only changed strings across one or more files/languages
- `POST /decode-error` — `{ code, targetLanguage? }` → plain-language, localized onchain error explanation
- `GET /glossary?term=...` or `?domainContext=...` — glossary lookup/listing
- `GET /metrics` — authenticated, process-local operational counters
- `GET /health` — unauthenticated health check (outside the `/api/v1` prefix)
- `GET /health/ready` — MongoDB/Redis readiness probe

REST successes use `{ "success": true, "data": ... }`; failures use `{ "success": false, "error": { "statusCode", "code", "message" }, "timestamp" }`.

## MCP Server

Runs alongside the HTTP API on `MCP_HTTP_PORT` (default `3100`). The preferred endpoint is Streamable HTTP at `/mcp` (`POST`/`GET`/`DELETE`); legacy SSE remains available through `GET /sse` and `POST /messages?sessionId=...`. Send the same bearer token on every request. Both paths enforce authentication, request-size limits, per-client rate limits, input schemas, and sanitized failures.

- `translate_text(text, targetLanguage)`
- `decode_error(code, targetLanguage?)`
- `glossary_lookup(term)`

This is the primary integration point for OKX.AI agents.

For local MCP clients that use stdio:

```bash
npm run build
npm run start:mcp:stdio
```

## Design notes

- **Provider-agnostic LLM client** (`src/semantic/llm-client.service.ts`): swapping LLM vendors is an env-var change, not a code change.
- **Two-tier cache**: Redis for hot-path latency, MongoDB `TranslationCache` for durability across Redis restarts/eviction — both keyed on `MD5(sourceText::targetLanguage)`. `RedisService` accepts either a full `REDIS_URL` connection string (required for TLS providers like Upstash) or discrete host/port/password.
- **Fail loudly, not silently**: a dropped placeholder token or a malformed LLM response triggers one corrective retry, then a hard error — Lumina never ships a translation it can't verify.
- **TS/JS i18n parsing** uses the TypeScript AST and accepts static object/array/scalar literals only. Repository code is never evaluated; dynamic expressions, spreads, getters, computed keys, and prototype-sensitive keys are rejected.
- **Key-path GitOps diffing**: `GitopsService` compares previous/current values by structural key path. Include `previousTranslatedContent: { "fr": "..." }` for each file to reuse unchanged localized values and translate only changed/new paths. Without a prior localized artifact, Lumina deliberately performs one complete translation so it never emits a mixed-language file.
- **API key auth**: `ApiKeyGuard` gates the billable endpoints (`/translate/*`, `/decode-error`, `/webhooks/git-sync`) behind `LUMINA_API_KEY` when set; a no-op locally if unset.
- **Global exception filter**: every unhandled error is normalized to a clean JSON error response server-side; stack traces are logged, never returned to callers.

## Production checks

```bash
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run verify:live
```

The automated suite covers parser extraction/lossless no-op round trips, adversarial nested shielding, validator rejection, corrective retry, no-persist-on-failure, key-path GitOps deltas, authentication, and Onchain/EVM error lookup. `verify:live` remains mandatory in the deployment environment because it exercises real MongoDB, Redis, and LLM credentials.

Mongo indexes are created and inspected at startup; startup fails if the required unique `stringHash` or glossary `term` index is missing. Translation metrics report only observed process counters—no estimated cost or fabricated performance numbers.

## Container deployment

`Dockerfile` builds a non-root production image. For a local production-shaped stack:

```bash
cp .env.example .env
# Set LUMINA_API_KEY and LLM_API_KEY in .env
docker compose up --build
```

Terminate TLS at the deployment load balancer or reverse proxy. Do not expose MongoDB or Redis publicly.
