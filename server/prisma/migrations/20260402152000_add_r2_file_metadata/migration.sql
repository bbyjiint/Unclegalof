-- CreateEnum
CREATE TYPE "StoredFilePurpose" AS ENUM ('PAYMENT_SLIP', 'REPAIR_IMAGE');

-- CreateTable
CREATE TABLE "R2File" (
    "id" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "purpose" "StoredFilePurpose" NOT NULL,
    "uploadedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "R2File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "R2File_objectKey_key" ON "R2File"("objectKey");

-- CreateIndex
CREATE INDEX "R2File_uploadedByUserId_idx" ON "R2File"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "R2File_purpose_idx" ON "R2File"("purpose");

-- CreateIndex
CREATE INDEX "R2File_createdAt_idx" ON "R2File"("createdAt");

-- AddForeignKey
ALTER TABLE "R2File" ADD CONSTRAINT "R2File_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
