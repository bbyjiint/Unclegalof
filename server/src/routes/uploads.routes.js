import { StoredFilePurpose } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { buildObjectKey, createPresignedUpload } from "../lib/r2.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { writeRateLimiter } from "../middleware/rateLimit.middleware.js";

const router = Router();

const presignUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  purpose: z.nativeEnum(StoredFilePurpose),
});

const saveMetadataSchema = z.object({
  objectKey: z.string().min(1),
  fileUrl: z.string().url(),
  originalFileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
  purpose: z.nativeEnum(StoredFilePurpose),
  bucketName: z.string().min(1),
});

router.post(
  "/presign-upload",
  authenticate,
  writeRateLimiter,
  validate(presignUploadSchema),
  async (req, res, next) => {
    try {
      const { fileName, contentType, purpose } = req.body;
      const objectKey = buildObjectKey({
        purpose,
        userId: req.user.id,
        fileName,
      });

      const { presignedUrl, publicFileUrl, bucketName } = await createPresignedUpload({
        objectKey,
        contentType,
      });

      res.json({
        presignedUrl,
        objectKey,
        publicFileUrl,
        bucketName,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/save-metadata",
  authenticate,
  writeRateLimiter,
  validate(saveMetadataSchema),
  async (req, res, next) => {
    try {
      const { objectKey, fileUrl, originalFileName, contentType, fileSize, purpose, bucketName } = req.body;

      const record = await prisma.r2File.upsert({
        where: { objectKey },
        update: {
          fileUrl,
          originalFileName,
          contentType,
          fileSize,
          purpose,
          bucketName,
        },
        create: {
          objectKey,
          fileUrl,
          originalFileName,
          contentType,
          fileSize,
          purpose,
          bucketName,
          uploadedByUserId: req.user.id,
        },
      });

      res.status(201).json({
        file: {
          id: record.id,
          objectKey: record.objectKey,
          fileUrl: record.fileUrl,
          purpose: record.purpose,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
