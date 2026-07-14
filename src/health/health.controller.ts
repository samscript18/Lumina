import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RedisService } from '../cache/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectConnection() private readonly mongo: Connection,
    private readonly redis: RedisService,
  ) {}

  @Get()
  check() {
    return { status: 'ok', service: 'lumina', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  async ready() {
    const dependencies = {
      mongodb: this.mongo.readyState === 1,
      redis: await this.redis.ping(),
    };
    if (!dependencies.mongodb || !dependencies.redis) {
      throw new ServiceUnavailableException({ status: 'not-ready', dependencies });
    }
    return { status: 'ready', dependencies, timestamp: new Date().toISOString() };
  }
}
