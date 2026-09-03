import 'reflect-metadata';
import { MongoClient } from 'mongodb';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import configuration from '../config/load-yaml.config';

// S3 DeleteObjects caps a single request at 1000 keys.
const DELETE_BATCH_SIZE = 1000;

export function keyFromUrl(url: string, publicUrl: string): string | null {
  const prefix = `${publicUrl.replace(/\/$/, '')}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export function findOrphanKeys(
  storageKeys: string[],
  referencedKeys: ReadonlySet<string>,
): string[] {
  return storageKeys.filter((key) => !referencedKeys.has(key));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

type AuditResult = {
  totalObjects: number;
  referencedObjects: number;
  orphanObjects: number;
  orphanKeys: string[];
};

class OrphanPhotosSweep {
  constructor(
    private readonly mongoClient: MongoClient,
    private readonly s3Client: S3Client,
    private readonly bucket: string,
    private readonly publicUrl: string,
  ) {}

  private async listStorageKeys(): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const page = await this.s3Client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'users/',
          ContinuationToken: continuationToken,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) keys.push(object.Key);
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    return keys;
  }

  private async listReferencedKeys(): Promise<Set<string>> {
    const users = this.mongoClient.db().collection('users');
    const cursor = users.find({}, { projection: { photos: 1 } });
    const referenced = new Set<string>();

    for await (const user of cursor) {
      for (const photoUrl of (user.photos as string[] | undefined) ?? []) {
        const key = keyFromUrl(photoUrl, this.publicUrl);
        if (key) referenced.add(key);
      }
    }

    return referenced;
  }

  async audit(): Promise<AuditResult> {
    const [storageKeys, referencedKeys] = await Promise.all([
      this.listStorageKeys(),
      this.listReferencedKeys(),
    ]);
    const orphanKeys = findOrphanKeys(storageKeys, referencedKeys);

    return {
      totalObjects: storageKeys.length,
      referencedObjects: referencedKeys.size,
      orphanObjects: orphanKeys.length,
      orphanKeys,
    };
  }

  async apply(): Promise<AuditResult> {
    const result = await this.audit();

    for (const batch of chunk(result.orphanKeys, DELETE_BATCH_SIZE)) {
      await this.s3Client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }

    return result;
  }
}

async function run(): Promise<void> {
  const mode = process.argv.includes('--apply') ? 'apply' : 'audit';
  const config = configuration();
  const mongoClient = new MongoClient(config.mongodb.uri);
  const s3Client = new S3Client({
    endpoint: config.storage.endpoint,
    region: config.storage.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.storage.accessKeyId,
      secretAccessKey: config.storage.secretAccessKey,
    },
  });

  try {
    await mongoClient.connect();
    const sweep = new OrphanPhotosSweep(
      mongoClient,
      s3Client,
      config.storage.bucket,
      config.storage.publicUrl,
    );

    if (mode === 'apply') {
      const result = await sweep.apply();
      console.log('Orphan photo cleanup completed', {
        totalObjects: result.totalObjects,
        referencedObjects: result.referencedObjects,
        deletedObjects: result.orphanObjects,
      });
    } else {
      const result = await sweep.audit();
      console.log('Orphan photo audit', {
        totalObjects: result.totalObjects,
        referencedObjects: result.referencedObjects,
        orphanObjects: result.orphanObjects,
      });
      if (result.orphanObjects > 0) {
        process.exitCode = 2;
      }
    }
  } finally {
    await mongoClient.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(
      'Orphan photo cleanup failed',
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
