import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SecretsService } from '../db/secrets';

let s3Client: S3Client | null = null;

async function getClient(): Promise<S3Client> {
    if (s3Client) return s3Client;

    const R2_ENDPOINT = process.env.CF_R2_ENDPOINT || await SecretsService.getDecryptedSecret('CF_R2_ENDPOINT');
    const R2_ACCESS_KEY_ID = process.env.CF_R2_ACCESS_KEY_ID || await SecretsService.getDecryptedSecret('CF_R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = process.env.CF_R2_SECRET_ACCESS_KEY || await SecretsService.getDecryptedSecret('CF_R2_SECRET_ACCESS_KEY');

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error("R2 configuration missing (Env or Secrets Vault)");
    }

    s3Client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY
        }
    });

    return s3Client;
}

export async function uploadAsset(key: string, body: Buffer | string, contentType: string = 'application/octet-stream'): Promise<void> {
    const bucket = process.env.CF_R2_BUCKET_NAME || await SecretsService.getDecryptedSecret('CF_R2_BUCKET_NAME');
    if (!bucket) throw new Error("CF_R2_BUCKET_NAME not set");

    const client = await getClient();
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
    });

    await client.send(command);
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    const bucket = process.env.CF_R2_BUCKET_NAME || await SecretsService.getDecryptedSecret('CF_R2_BUCKET_NAME');
    if (!bucket) throw new Error("CF_R2_BUCKET_NAME not set");

    const client = await getClient();
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
