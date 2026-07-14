import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { createHash } from 'crypto';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class DistributedRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const credential = request.headers.authorization ?? request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const identity = createHash('sha256').update(credential).digest('hex').slice(0, 24);
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const limit = request.path.includes('/webhooks/') ? 300 : 120;
    const result = await this.redis.consumeRateLimit(`${identity}:${route}`, limit, 60);
    if (!result.allowed) throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
