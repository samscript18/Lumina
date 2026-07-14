import { ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function responseHarness() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter body-parser errors', () => {
  it('returns 413 for an oversized request body', () => {
    const { host, status, json } = responseHarness();
    new AllExceptionsFilter().catch({ type: 'entity.too.large', status: 413 }, host);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE', statusCode: 413 }),
    }));
  });

  it('returns 400 for malformed JSON', () => {
    const { host, status, json } = responseHarness();
    new AllExceptionsFilter().catch({ type: 'entity.parse.failed', status: 400 }, host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ code: 'BAD_REQUEST', statusCode: 400 }),
    }));
  });
});
