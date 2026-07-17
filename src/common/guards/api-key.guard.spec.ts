import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

const context = (authorization?: string, payment?: { protocol: 'x402'; network: string }) => {
  const request = { headers: { authorization }, luminaPayment: payment };
  return {
    request,
    value: ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => 'handler', getClass: () => 'class',
    }) as never,
  };
};

describe('ApiKeyGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => []) };
  const credentials = { authenticate: jest.fn(async () => null) };

  it('requires configuration in production', async () => {
    const guard = new ApiKeyGuard(
      { get: (key: string) => key === 'nodeEnv' ? 'production' : undefined } as never,
      reflector as never, credentials as never,
    );
    await expect(guard.canActivate(context().value)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts the configured bearer token', async () => {
    const guard = new ApiKeyGuard(
      { get: (key: string) => key === 'apiKey' ? 'secret' : 'production' } as never,
      reflector as never, credentials as never,
    );
    await expect(guard.canActivate(context('Bearer secret').value)).resolves.toBe(true);
  });

  it('authenticates a scoped database credential and attributes the request', async () => {
    const scopedReflector = { getAllAndOverride: jest.fn(() => ['translate']) };
    const database = { authenticate: jest.fn(async () => ({ id: '1', name: 'dapp', prefix: 'lum_live_abc', scopes: ['translate'], source: 'database' })) };
    const guard = new ApiKeyGuard({ get: () => 'production' } as never, scopedReflector as never, database as never);
    const ctx = context('Bearer lum_live_test');
    await expect(guard.canActivate(ctx.value)).resolves.toBe(true);
    expect(ctx.request).toHaveProperty('luminaCredential.name', 'dapp');
  });

  it('rejects a database credential without the required scope', async () => {
    const scopedReflector = { getAllAndOverride: jest.fn(() => ['admin']) };
    const database = { authenticate: jest.fn(async () => ({ id: '1', name: 'dapp', prefix: 'lum_live_abc', scopes: ['translate'], source: 'database' })) };
    const guard = new ApiKeyGuard({ get: () => 'production' } as never, scopedReflector as never, database as never);
    await expect(guard.canActivate(context('Bearer lum_live_test').value)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts verified x402 payment for the MCP scope', async () => {
    const scopedReflector = { getAllAndOverride: jest.fn(() => ['mcp']) };
    const guard = new ApiKeyGuard({ get: () => 'production' } as never, scopedReflector as never, credentials as never);
    const ctx = context(undefined, { protocol: 'x402', network: 'eip155:196' });
    await expect(guard.canActivate(ctx.value)).resolves.toBe(true);
    expect(ctx.request).toHaveProperty('luminaCredential.source', 'x402');
  });

  it('does not let x402 payment bypass non-MCP scopes', async () => {
    const scopedReflector = { getAllAndOverride: jest.fn(() => ['admin']) };
    const guard = new ApiKeyGuard({ get: () => 'production' } as never, scopedReflector as never, credentials as never);
    await expect(guard.canActivate(context(undefined, { protocol: 'x402', network: 'eip155:196' }).value))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
