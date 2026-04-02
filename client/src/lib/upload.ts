import { api } from "./api";
import type { StoredFilePurpose } from "../types";

export async function uploadFileToR2(file: File, purpose: StoredFilePurpose): Promise<string> {
  const presigned = await api.presignUpload({
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
    purpose,
  });

  const uploadResponse = await fetch(presigned.presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }

  await api.saveUploadMetadata({
    objectKey: presigned.objectKey,
    fileUrl: presigned.publicFileUrl,
    bucketName: presigned.bucketName,
    originalFileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
    purpose,
  });

  return presigned.publicFileUrl;
}
