import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private readonly ttlSeconds: number;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redisUrl');
    if (url) {
      // ioredis parses rediss:// (TLS) / redis:// and any embedded auth token automatically.
      this.client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    } else {
      this.client = new Redis({
        host: this.config.get<string>('redis.host'),
        port: this.config.get<number>('redis.port'),
        password: this.config.get<string>('redis.password'),
        lazyConnect: true,
        maxRetriesPerRequest: 2,
      });
    }
    this.ttlSeconds = this.config.get<number>('cacheTtlSeconds') ?? 2592000;

    this.client.on('error', (err) => this.logger.warn(`Redis connection issue: ${err.message}`));
  }

  static hashKey(sourceText: string, targetLanguage: string): string {
    return crypto.createHash('md5').update(`${sourceText}::${targetLanguage}`).digest('hex');
  }

  async connectIfNeeded(): Promise<void> {
    if (this.client.status === 'wait' || this.client.status === 'end') {
      await this.client.connect().catch((err) => {
        this.logger.warn(`Redis connect failed, cache will be bypassed: ${err.message}`);
      });
    }
  }

  async get(sourceText: string, targetLanguage: string): Promise<string | null> {
    await this.connectIfNeeded();
    try {
      const key = `lumina:tx:${RedisService.hashKey(sourceText, targetLanguage)}`;
      return await this.client.get(key);
    } catch (err) {
      this.logger.warn(`Cache GET failed, falling back to LLM: ${(err as Error).message}`);
      return null;
    }
  }

  async set(sourceText: string, targetLanguage: string, translatedText: string): Promise<void> {
    await this.connectIfNeeded();
    try {
      const key = `lumina:tx:${RedisService.hashKey(sourceText, targetLanguage)}`;
      await this.client.set(key, translatedText, 'EX', this.ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache SET failed (non-fatal): ${(err as Error).message}`);
    }
  }

  async ping(): Promise<boolean> {
    await this.connectIfNeeded();
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async acquireLock(key: string, ttlMs = 30_000): Promise<string | null> {
    await this.connectIfNeeded();
    const token = crypto.randomUUID();
    try {
      const result = await this.client.set(`lumina:lock:${key}`, token, 'PX', ttlMs, 'NX');
      return result === 'OK' ? token : null;
    } catch (error) {
      this.logger.warn(`Redis lock acquisition failed: ${(error as Error).message}`);
      return token; // fail open so a Redis outage does not stop translation
    }
  }

  async releaseLock(key: string, token: string): Promise<void> {
    try {
      await this.client.eval(
        'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
        1,
        `lumina:lock:${key}`,
        token,
      );
    } catch (error) {
      this.logger.warn(`Redis lock release failed: ${(error as Error).message}`);
    }
  }

  async claimIdempotencyKey(key: string, ttlSeconds = 86_400): Promise<boolean> {
    await this.connectIfNeeded();
    try {
      return (await this.client.set(`lumina:idempotency:${key}`, '1', 'EX', ttlSeconds, 'NX')) === 'OK';
    } catch (error) {
      this.logger.warn(`Idempotency check failed: ${(error as Error).message}`);
      return true;
    }
  }

  async releaseIdempotencyKey(key: string): Promise<void> {
    try { await this.client.del(`lumina:idempotency:${key}`); } catch { /* a retry will be possible after TTL */ }
  }

  async consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
    await this.connectIfNeeded();
    const redisKey = `lumina:rate:${key}`;
    try {
      const count = await this.client.incr(redisKey);
      if (count === 1) await this.client.expire(redisKey, windowSeconds);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    } catch (error) {
      this.logger.warn(`Distributed rate limit unavailable: ${(error as Error).message}`);
      return { allowed: true, remaining: limit };
    }
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
