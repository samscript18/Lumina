import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

const context = (authorization?: string) => ({
  switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
}) as never;

describe('ApiKeyGuard', () => {
  it('requires configuration in production', () => {
    const guard = new ApiKeyGuard({ get: (key: string) => key === 'nodeEnv' ? 'production' : undefined } as never);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
  });

  it('accepts the configured bearer token', () => {
    const guard = new ApiKeyGuard({ get: (key: string) => key === 'apiKey' ? 'secret' : 'production' } as never);
    expect(guard.canActivate(context('Bearer secret'))).toBe(true);
  });
});
