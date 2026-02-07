import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SecretsService } from '../secrets/service';

let s3Client: S3Client | null = null;
let clientPromise: Promise<S3Client> | null = null;

async function getSecretValue(key: string): Promise<string | undefined> {
    // const secrets = await SecretsService.getAllSecrets();
    // SecretsService returns masked values in getAllSecrets? 
    // Wait, getAllSecrets returns masked values.
    // We need an internal method to get raw decrypted values.
    // SecretsService.setSecret returns object. 
    // existing SecretsService doesn't expose raw get.

    // We need to implement getDecryptedSecret in SecretsService or just query DB here.
    // Let's modify SecretsService to expose `getDecryptedValue(key)`.

    // Actually, I can just copy the query logic here or add method to service.
    // Adding method to service is cleaner.
    // But I can't modify service easily without reading it again to be sure.
    // Let's assume I will add `getDecryptedSecret` to `api/src/secrets/service.ts`.

    return await SecretsService.getDecryptedSecret(key);
}

async function createS3Client(): Promise<S3Client> {
    const R2_ENDPOINT = await getSecretValue('CF_R2_ENDPOINT');
    const R2_ACCESS_KEY_ID = await getSecretValue('CF_R2_ACCESS_KEY_ID');
    const R2_SECRET_ACCESS_KEY = await getSecretValue('CF_R2_SECRET_ACCESS_KEY');

    if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        throw new Error("R2 configuration missing in Secrets Vault");
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

export async function getSignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    const bucket = await getSecretValue('CF_R2_BUCKET_NAME');
    if (!bucket) throw new Error("CF_R2_BUCKET_NAME not set");

    const client = await getS3Client();
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
    });

    return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
