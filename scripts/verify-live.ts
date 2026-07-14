import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Redis from 'ioredis';

const results: { name: string; ok: boolean; detail: string }[] = [];

async function checkMongo(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) { results.push({ name: 'MongoDB', ok: false, detail: 'MONGODB_URI not set' }); return; }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
    await mongoose.connection.db!.admin().ping();
    results.push({ name: 'MongoDB', ok: true, detail: `Connected to ${mongoose.connection.name}` });
    await mongoose.disconnect();
  } catch (err) {
    results.push({ name: 'MongoDB', ok: false, detail: (err as Error).message });
  }
}

async function checkRedis(): Promise<void> {
  const url = process.env.REDIS_URL;
  if (!url) { results.push({ name: 'Redis', ok: false, detail: 'REDIS_URL not set' }); return; }
  const client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
  try {
    await client.connect();
    const pong = await client.ping();
    await client.set('lumina:verify:ping', 'ok', 'EX', 30);
    const readback = await client.get('lumina:verify:ping');
    results.push({ name: 'Redis', ok: pong === 'PONG' && readback === 'ok', detail: `PING -> ${pong}, roundtrip -> ${readback}` });
  } catch (err) {
    results.push({ name: 'Redis', ok: false, detail: (err as Error).message });
  } finally {
    client.disconnect();
  }
}

async function checkGroq(): Promise<void> {
  const apiKey = process.env.LLM_API_KEY || process.env.GROQ_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1';
  const model = process.env.LLM_MODEL ?? 'llama-3.3-70b-versatile';
  if (!apiKey) { results.push({ name: 'Groq/LLM', ok: false, detail: 'LLM_API_KEY / GROQ_API_KEY not set' }); return; }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are Lumina, a Web3-specialized localization engine. Translate the user text into pt-BR. Copy any __LUMINA_SHIELD_N__ token unchanged. Return only the translation.',
          },
          { role: 'user', content: 'Connect your __LUMINA_SHIELD_0__ to continue.' },
        ],
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      results.push({ name: 'Groq/LLM', ok: false, detail: `HTTP ${res.status}: ${await res.text()}` });
      return;
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    const preservedToken = content.includes('__LUMINA_SHIELD_0__');
    results.push({
      name: 'Groq/LLM',
      ok: Boolean(content) && preservedToken,
      detail: `Response: "${content.trim()}" ${preservedToken ? '(token preserved ✓)' : '(TOKEN DROPPED ✗)'}`,
    });
  } catch (err) {
    results.push({ name: 'Groq/LLM', ok: false, detail: (err as Error).message });
  }
}

async function main() {
  await checkMongo();
  await checkRedis();
  await checkGroq();

  console.log('\n=== Lumina Live Infra Verification ===');
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}: ${r.detail}`);
  }
  const allOk = results.every((r) => r.ok);
  console.log(allOk ? '\nAll checks passed — infra is live and reachable.' : '\nOne or more checks failed — see above.');
  process.exit(allOk ? 0 : 1);
}

main();
