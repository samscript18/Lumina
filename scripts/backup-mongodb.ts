import * as dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE ?? '.env.local' });
import { MongoClient } from 'mongodb';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { BackupLine, BackupManifest, checksum, encodeBackup } from './backup-utils';

const COLLECTIONS = ['translation_cache', 'web3_glossary', 'api_credentials'];

async function main() {
  const uri = process.env.MONGODB_URI, bucket = process.env.BACKUP_S3_BUCKET;
  if (!uri || !bucket) throw new Error('MONGODB_URI and BACKUP_S3_BUCKET are required');
  const client = new MongoClient(uri), lines: BackupLine[] = [], counts: Record<string, number> = {};
  await client.connect();
  try {
    const db = client.db();
    for (const collection of COLLECTIONS) {
      const documents = await db.collection(collection).find({}).toArray();
      counts[collection] = documents.length;
      for (const document of documents) lines.push({ collection, document });
    }
    const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), database: db.databaseName, collections: counts };
    const body = encodeBackup(manifest, lines);
    const objectKey = `${process.env.BACKUP_S3_PREFIX ?? 'lumina'}/${manifest.createdAt.replace(/[:.]/g, '-')}.lumbkp`;
    const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-east-1', endpoint: process.env.BACKUP_S3_ENDPOINT || undefined, forcePathStyle: process.env.BACKUP_S3_FORCE_PATH_STYLE === 'true' });
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: body, ContentType: 'application/octet-stream', Metadata: { sha256: checksum(body), format: 'LUMBKP01' } }));
    console.log(JSON.stringify({ bucket, objectKey, collections: counts, bytes: body.length, sha256: checksum(body) }));
  } finally { await client.close(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
