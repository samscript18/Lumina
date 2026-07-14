import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';
import { decodeBackup } from './backup-utils';

async function main() {
  const bucket = process.env.BACKUP_S3_BUCKET, objectKey = process.env.BACKUP_OBJECT_KEY, restoreUri = process.env.RESTORE_MONGODB_URI;
  if (!bucket || !objectKey || !restoreUri) throw new Error('BACKUP_S3_BUCKET, BACKUP_OBJECT_KEY, and RESTORE_MONGODB_URI are required');
  if (restoreUri === process.env.MONGODB_URI) throw new Error('Refusing to restore into the production MONGODB_URI');
  if (process.env.RESTORE_CONFIRM !== 'RESTORE_TO_NON_PRODUCTION') throw new Error('Set RESTORE_CONFIRM=RESTORE_TO_NON_PRODUCTION');
  const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1', endpoint: process.env.BACKUP_S3_ENDPOINT || undefined, forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === 'true' });
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
  const decoded = decodeBackup(Buffer.from(await object.Body!.transformToByteArray()));
  const client = new MongoClient(restoreUri); await client.connect();
  try {
    const db = client.db();
    for (const collection of Object.keys(decoded.manifest.collections)) {
      await db.collection(collection).deleteMany({});
      const documents = decoded.lines.filter((line) => line.collection === collection).map((line) => line.document as Record<string, unknown>);
      if (documents.length) await db.collection(collection).insertMany(documents);
      const restored = await db.collection(collection).countDocuments();
      if (restored !== decoded.manifest.collections[collection]) throw new Error(`Restore count mismatch for ${collection}`);
    }
    console.log(JSON.stringify({ restored: true, sourceCreatedAt: decoded.manifest.createdAt, collections: decoded.manifest.collections }));
  } finally { await client.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
