import { randomBytes } from 'crypto';
import { decodeBackup, encodeBackup } from './backup-utils';

describe('encrypted backup format', () => {
  const previous = process.env.BACKUP_ENCRYPTION_KEY;
  beforeEach(() => { process.env.BACKUP_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });
  afterAll(() => {
    if (previous === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = previous;
  });

  it('round-trips BSON values and collection counts', () => {
    const manifest = { version: 1 as const, createdAt: new Date().toISOString(), database: 'lumina', collections: { web3_glossary: 1 } };
    const encoded = encodeBackup(manifest, [{ collection: 'web3_glossary', document: { term: 'wallet', createdAt: new Date(0) } }]);
    const decoded = decodeBackup(encoded);
    expect(decoded.manifest).toEqual(manifest);
    expect(decoded.lines).toHaveLength(1);
    expect(decoded.lines[0]!.document).toMatchObject({ term: 'wallet', createdAt: new Date(0) });
  });

  it('rejects tampered ciphertext', () => {
    const encoded = encodeBackup({ version: 1, createdAt: new Date().toISOString(), database: 'lumina', collections: {} }, []);
    encoded[25] = encoded[25]! ^ 1;
    expect(() => decodeBackup(encoded)).toThrow();
  });
});
