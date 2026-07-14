import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { EJSON } from 'bson';

const MAGIC = Buffer.from('LUMBKP01');

export interface BackupLine { collection: string; document: unknown }
export interface BackupManifest { version: 1; createdAt: string; database: string; collections: Record<string, number> }

function key(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) throw new Error('BACKUP_ENCRYPTION_KEY is required (base64-encoded 32-byte key)');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return decoded;
}

export function encodeBackup(manifest: BackupManifest, lines: BackupLine[]): Buffer {
  const plaintext = [EJSON.stringify({ manifest }), ...lines.map((line) => EJSON.stringify(line))].join('\n');
  const compressed = gzipSync(Buffer.from(plaintext));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return Buffer.concat([MAGIC, iv, encrypted, cipher.getAuthTag()]);
}

export function decodeBackup(input: Buffer): { manifest: BackupManifest; lines: BackupLine[] } {
  if (!input.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid Lumina backup header');
  const iv = input.subarray(8, 20), tag = input.subarray(input.length - 16), encrypted = input.subarray(20, input.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  const text = gunzipSync(Buffer.concat([decipher.update(encrypted), decipher.final()])).toString('utf8');
  const [header, ...records] = text.split('\n');
  const parsed = EJSON.parse(header!) as { manifest: BackupManifest };
  return { manifest: parsed.manifest, lines: records.filter(Boolean).map((line) => EJSON.parse(line) as BackupLine) };
}

export function checksum(input: Buffer): string { return createHash('sha256').update(input).digest('hex'); }
