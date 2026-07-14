import * as dotenv from 'dotenv';
import { performance } from 'perf_hooks';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });

const baseUrl = (process.env.LUMINA_BASE_URL ?? 'https://lumina-e3vi.onrender.com').replace(/\/$/, '');
const durationMs = Number(process.env.LOAD_DURATION_SECONDS ?? 30) * 1000;
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS ?? 2_500);
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);
const path = process.env.LOAD_PATH ?? '/health';
const apiKeys = (process.env.LOAD_API_KEYS ?? '').split(',').map((key) => key.trim()).filter(Boolean);
const runId = Math.random().toString(36).slice(2);
const latencies: number[] = [];
let failures = 0;

async function worker(deadline: number, workerId: number) {
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      const credential = apiKeys[workerId % Math.max(1, apiKeys.length)];
      if (path.startsWith('/api/') && !credential) throw new Error('LOAD_API_KEYS is required for protected LOAD_PATH values');
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { authorization: `Bearer ${credential ?? `load-probe-${runId}-${workerId}`}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch { failures += 1; }
    latencies.push(performance.now() - started);
  }
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] ?? 0;
}

async function main() {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 200) throw new Error('LOAD_CONCURRENCY must be 1..200');
  const deadline = Date.now() + durationMs;
  await Promise.all(Array.from({ length: concurrency }, (_, index) => worker(deadline, index)));
  const errorRate = failures / Math.max(1, latencies.length);
  const summary = { requests: latencies.length, failures, errorRate, p50Ms: percentile(latencies, .5), p95Ms: percentile(latencies, .95), p99Ms: percentile(latencies, .99) };
  console.log(JSON.stringify(summary));
  if (summary.p95Ms > maxP95Ms || errorRate > maxErrorRate) process.exit(1);
}
main().catch((error) => { console.error(error); process.exit(1); });
