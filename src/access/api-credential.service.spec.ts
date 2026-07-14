import { ApiCredentialService } from './api-credential.service';

describe('ApiCredentialService', () => {
  it('uses deterministic one-way hashes without retaining plaintext keys', () => {
    const key = 'lum_live_secret-value';
    const hash = ApiCredentialService.hash(key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(key);
    expect(ApiCredentialService.hash(key)).toBe(hash);
  });
});
