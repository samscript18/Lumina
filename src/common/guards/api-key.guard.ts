import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';
import { ApiCredentialService } from '../../access/api-credential.service';
import { REQUIRED_SCOPES } from '../../access/scopes.decorator';

export interface AuthenticatedRequest extends Request {
  luminaCredential?: { id?: string; name: string; prefix: string; scopes: string[]; source: 'environment' | 'database' };
}

/**
 * Simple bearer-token guard. If LUMINA_API_KEY is unset, the guard is a
 * no-op (open) so local/dev usage isn't blocked — but any deployed instance
 * should set LUMINA_API_KEY, since translate/decode-error calls spend real
 * LLM provider credits.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly credentials: ApiCredentialService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers['authorization'];
    const provided = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '') : undefined;

    const validEnvironmentKey = Boolean(provided && requiredKeys.some((key) => {
      const expected = Buffer.from(key);
      const actual = Buffer.from(provided);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    }));
    if (validEnvironmentKey) {
      req.luminaCredential = { name: 'environment-bootstrap', prefix: 'env', scopes: ['*'], source: 'environment' };
      return true;
    }

    const databaseCredential = provided ? await this.credentials.authenticate(provided) : null;
    if (!databaseCredential) {
      throw new UnauthorizedException('Missing or invalid API key. Set Authorization: Bearer <LUMINA_API_KEY>.');
    }

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(REQUIRED_SCOPES, [context.getHandler(), context.getClass()]) ?? [];
    if (requiredScopes.some((scope) => !databaseCredential.scopes.includes(scope))) {
      throw new ForbiddenException(`API key requires scope: ${requiredScopes.join(', ')}`);
    }
    req.luminaCredential = databaseCredential;
    return true;
  }
}
