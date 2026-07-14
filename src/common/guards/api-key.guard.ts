import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

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
    const requiredKey = this.config.get<string>('apiKey');
    if (!requiredKey) {
      if (this.config.get<string>('nodeEnv') === 'production') {
        throw new UnauthorizedException('LUMINA_API_KEY must be configured in production.');
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    const provided = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : undefined;

    if (!provided || provided !== requiredKey) {
      throw new UnauthorizedException('Missing or invalid API key. Set Authorization: Bearer <LUMINA_API_KEY>.');
    }
    return true;
  }
}
