import { ExecutionContext, HttpException } from '@nestjs/common';
import { DistributedRateLimitGuard } from './distributed-rate-limit.guard';

describe('DistributedRateLimitGuard', () => {
  const contextFor = (path = '/api/v1/translate/string') => ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path,
        route: { path },
        headers: { authorization: 'Bearer test-key' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      }),
    }),
  }) as unknown as ExecutionContext;

  it('allows requests while the distributed quota remains', async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 119 }) };
    const guard = new DistributedRateLimitGuard(redis as never);

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(expect.any(String), 120, 60);
  });

  it('rejects requests after the distributed quota is exhausted', async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ allowed: false, remaining: 0 }) };
    const guard = new DistributedRateLimitGuard(redis as never);

    await expect(guard.canActivate(contextFor())).rejects.toBeInstanceOf(HttpException);
  });

  it('uses the higher webhook delivery quota', async () => {
    const redis = { consumeRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 299 }) };
    const guard = new DistributedRateLimitGuard(redis as never);

    await guard.canActivate(contextFor('/api/v1/webhooks/git-sync'));
    expect(redis.consumeRateLimit).toHaveBeenCalledWith(expect.any(String), 300, 60);
  });
});
