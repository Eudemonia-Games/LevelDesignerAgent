import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSecret } from '../db/secrets';

let s3Client: S3Client | null = null;
let clientPromise: Promise<S3Client> | null = null;

async function createS3Client(): Promise<S3Client> {
    const R2_ENDPOINT = await getSecret('CF_R2_ENDPOINT');
    const R2_ACCESS_KEY_ID = await getSecret('CF_R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = await getSecret('CF_R2_SECRET_ACCESS_KEY');

    // Bucket name is needed for operations but not client initialization technically,
    // but usually nice to fail fast if missing.
    // However, bucket name is used per operation.

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error("R2 configuration missing in Secrets Vault (CF_R2_ENDPOINT, CF_R2_ACCESS_KEY_ID, CF_R2_SECRET_ACCESS_KEY)");
    }

    return new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY
        }
    });
}

function getS3Client(): Promise<S3Client> {
    if (s3Client) return Promise.resolve(s3Client);
    if (!clientPromise) {
        clientPromise = createS3Client().then(c => {
            s3Client = c;
            return c;
        });
    }
    return clientPromise;
}

export async function uploadAsset(key: string, body: Buffer | string, contentType: string = 'application/octet-stream'): Promise<void> {
    const bucket = await getSecret('CF_R2_BUCKET_NAME');
    if (!bucket) throw new Error("CF_R2_BUCKET_NAME not set in Secrets Vault");

    const client = await getS3Client();
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
    });

    await client.send(command);
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    const bucket = await getSecret('CF_R2_BUCKET_NAME');
    if (!bucket) throw new Error("CF_R2_BUCKET_NAME not set in Secrets Vault");

    const client = await getS3Client();
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    // getSignedUrl takes client instance as first arg
    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
