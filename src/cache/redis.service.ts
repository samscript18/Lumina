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

  onModuleDestroy() {
    this.client.disconnect();
  }
}
