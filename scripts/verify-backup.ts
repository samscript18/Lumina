import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });
import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { checksum, decodeBackup } from './backup-utils';

async function main() {
  const bucket = process.env.BACKUP_S3_BUCKET, objectKey = process.env.BACKUP_OBJECT_KEY;
  if (!bucket || !objectKey) throw new Error('BACKUP_S3_BUCKET and BACKUP_OBJECT_KEY are required');
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1', endpoint: process.env.BACKUP_S3_ENDPOINT || undefined, forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === 'true' });
  const [head, object] = await Promise.all([s3.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey })), s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))]);
  const body = Buffer.from(await object.Body!.transformToByteArray());
  if (head.Metadata?.sha256 && head.Metadata.sha256 !== checksum(body)) throw new Error('Backup checksum mismatch');
  const decoded = decodeBackup(body), actual: Record<string, number> = {};
  for (const line of decoded.lines) actual[line.collection] = (actual[line.collection] ?? 0) + 1;
  for (const [collection, expected] of Object.entries(decoded.manifest.collections)) if ((actual[collection] ?? 0) !== expected) throw new Error(`Count mismatch for ${collection}`);
  console.log(JSON.stringify({ verified: true, objectKey, createdAt: decoded.manifest.createdAt, collections: actual }));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
