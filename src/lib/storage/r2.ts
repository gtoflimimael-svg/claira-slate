import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let cached: S3Client | null = null;

function getClient(): S3Client {
  if (!cached) {
    cached = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return cached;
}

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

export async function uploadToR2(key: string, body: Buffer, contentType: string) {
  await getClient().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getSignedDownloadUrl(key: string, filename: string, ttlSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
  });
  return getSignedUrl(getClient(), command, { expiresIn: ttlSeconds });
}

export async function deleteFromR2(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// The bucket has no CORS policy for browser fetch(), so the client can't read
// object bytes directly from a presigned URL (only navigate to it, which is
// how downloads still work). Used to stream bytes same-origin instead, e.g.
// for client-side thumbnail rendering.
export async function getObject(key: string): Promise<{ body: Uint8Array; contentType?: string } | null> {
  try {
    const res = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body?.transformToByteArray();
    if (!body) return null;
    return { body, contentType: res.ContentType };
  } catch {
    return null;
  }
}
