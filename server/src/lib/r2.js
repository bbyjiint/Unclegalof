import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") || "";

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`${name} environment variable is required for R2 uploads`);
  }
  return value;
}

function sanitizeFileName(fileName) {
  return String(fileName || "upload")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function getR2Client() {
  const accountId = requireEnv("R2_ACCOUNT_ID", R2_ACCOUNT_ID);
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID", R2_ACCESS_KEY_ID);
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY", R2_SECRET_ACCESS_KEY);

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export function getR2BucketName() {
  return requireEnv("R2_BUCKET_NAME", R2_BUCKET_NAME);
}

export function getPublicFileUrl(objectKey) {
  const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL", R2_PUBLIC_BASE_URL);
  return `${publicBaseUrl}/${objectKey}`;
}

/**
 * Returns the R2 object key for a public URL served from R2_PUBLIC_BASE_URL, or null if not ours.
 */
export function objectKeyFromPublicUrl(fileUrl) {
  const base = R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") || "";
  if (!base || typeof fileUrl !== "string") {
    return null;
  }
  const cleanUrl = fileUrl.split(/[?#]/)[0];
  if (!cleanUrl.startsWith(`${base}/`)) {
    return null;
  }
  const key = cleanUrl.slice(base.length + 1);
  if (!key || key.includes("..")) {
    return null;
  }
  return key;
}

export async function deleteR2Object(objectKey) {
  const client = getR2Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: getR2BucketName(),
      Key: objectKey,
    })
  );
}

export function buildObjectKey({ purpose, userId, fileName }) {
  const safeName = sanitizeFileName(fileName);
  return `${purpose.toLowerCase()}/${userId}/${randomUUID()}-${safeName}`;
}

export async function createPresignedUpload({ objectKey, contentType, expiresIn = 300 }) {
  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: getR2BucketName(),
    Key: objectKey,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(client, command, { expiresIn });

  return {
    presignedUrl,
    publicFileUrl: getPublicFileUrl(objectKey),
    bucketName: getR2BucketName(),
  };
}
