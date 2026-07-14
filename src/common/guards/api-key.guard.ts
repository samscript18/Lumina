import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Simple bearer-token guard. If LUMINA_API_KEY is unset, the guard is a
 * no-op (open) so local/dev usage isn't blocked — but any deployed instance
 * should set LUMINA_API_KEY, since translate/decode-error calls spend real
 * LLM provider credits.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const value = this.config.get<string[]>('apiKeys');
    const configured = Array.isArray(value) ? value : [];
    const fallback = this.config.get<string>('apiKey');
    const requiredKeys = configured.length > 0 ? configured : fallback ? [fallback] : [];
    if (requiredKeys.length === 0) {
      if (this.config.get<string>('nodeEnv') === 'production') {
        throw new UnauthorizedException('LUMINA_API_KEY must be configured in production.');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    const provided = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : undefined;

    const valid = Boolean(provided && requiredKeys.some((key) => {
      const expected = Buffer.from(key);
      const actual = Buffer.from(provided);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }));
    if (!valid) {
      throw new UnauthorizedException('Missing or invalid API key. Set Authorization: Bearer <LUMINA_API_KEY>.');
    }
    return true;
  }
}
