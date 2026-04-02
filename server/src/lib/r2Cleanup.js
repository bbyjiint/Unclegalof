import { prisma } from "./prisma.js";
import { deleteR2Object, objectKeyFromPublicUrl } from "./r2.js";

/**
 * Deletes the object in R2 and removes matching `R2File` rows.
 * Resolves the key via `R2File.fileUrl` first (reliable), then `R2_PUBLIC_BASE_URL` parsing.
 * No-op for missing/legacy URLs (e.g. data URLs, non-bucket URLs).
 */
export async function deleteUploadedFileFromR2(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") {
    return;
  }
  const raw = fileUrl.trim();
  if (!raw || raw.startsWith("data:")) {
    return;
  }

  const normalized = raw.split(/[?#]/)[0];

  const meta = await prisma.r2File.findFirst({
    where: {
      OR: [{ fileUrl: normalized }, { fileUrl: raw }],
    },
  });

  const objectKey = meta?.objectKey ?? objectKeyFromPublicUrl(raw);
  if (!objectKey) {
    return;
  }

  await deleteR2Object(objectKey);
  await prisma.r2File.deleteMany({ where: { objectKey } });
}

export async function deleteUploadedFilesFromR2(fileUrls) {
  if (!Array.isArray(fileUrls) || fileUrls.length === 0) {
    return;
  }
  await Promise.all(fileUrls.map((u) => deleteUploadedFileFromR2(u)));
}
