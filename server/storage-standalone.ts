/**
 * Standalone S3 storage adapter for Railway/self-hosted deployment.
 * Uses standard AWS SDK when MANUS_STORAGE is not available.
 * Falls back to local filesystem storage if no S3 credentials are provided.
 */
import { ENV } from "./_core/env";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isManusEnvironment(): boolean {
  return !!(ENV.forgeApiUrl && ENV.forgeApiKey);
}

// For Railway: use AWS S3 if credentials are provided
function getS3Config() {
  return {
    bucket: process.env.S3_BUCKET || "",
    region: process.env.S3_REGION || "ap-southeast-2",
    accessKey: process.env.S3_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || "",
    secretKey: process.env.S3_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || "",
    endpoint: process.env.S3_ENDPOINT || "",
  };
}

function hasS3Config(): boolean {
  const cfg = getS3Config();
  return !!(cfg.bucket && cfg.accessKey && cfg.secretKey);
}

// Local filesystem fallback for development without S3
const LOCAL_STORAGE_DIR = path.join(__dirname, "..", "local-storage");

function ensureLocalDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Upload a file. Routes to:
 * 1. Manus S3 (if in Manus environment)
 * 2. AWS S3 (if S3 env vars are set)
 * 3. Local filesystem (fallback for dev)
 */
export async function storagePutStandalone(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  // If Manus environment, delegate to the original storage module
  if (isManusEnvironment()) {
    const { storagePut } = await import("./storage");
    return storagePut(relKey, data, contentType);
  }

  const key = appendHashSuffix(normalizeKey(relKey));

  // AWS S3 via standard SDK
  if (hasS3Config()) {
    const cfg = getS3Config();
    // Use @aws-sdk/client-s3 if available, otherwise fall through to local
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKey, secretAccessKey: cfg.secretKey },
        ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
      });
      const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
      await client.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }));
      const url = cfg.endpoint
        ? `${cfg.endpoint}/${cfg.bucket}/${key}`
        : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
      return { key, url };
    } catch (e: any) {
      console.warn("AWS S3 upload failed, falling back to local storage:", e.message);
    }
  }

  // Local filesystem fallback
  const localPath = path.join(LOCAL_STORAGE_DIR, key);
  ensureLocalDir(localPath);
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(localPath, buffer);
  return { key, url: `/local-storage/${key}` };
}

/**
 * Get a URL for a stored file.
 */
export async function storageGetStandalone(relKey: string): Promise<{ key: string; url: string }> {
  if (isManusEnvironment()) {
    const { storageGet } = await import("./storage");
    return storageGet(relKey);
  }
  const key = normalizeKey(relKey);
  if (hasS3Config()) {
    const cfg = getS3Config();
    const url = cfg.endpoint
      ? `${cfg.endpoint}/${cfg.bucket}/${key}`
      : `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${key}`;
    return { key, url };
  }
  return { key, url: `/local-storage/${key}` };
}
