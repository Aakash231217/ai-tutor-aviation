-- AlterTable
ALTER TABLE "ExtractedImage" ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "chapterNumber" INTEGER,
ADD COLUMN     "cloudinaryId" TEXT,
ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "relevanceScore" INTEGER NOT NULL DEFAULT 50;

-- CreateIndex
CREATE INDEX "ExtractedImage_fileId_chapterNumber_idx" ON "ExtractedImage"("fileId", "chapterNumber");

-- CreateIndex
CREATE INDEX "ExtractedImage_fileId_relevanceScore_idx" ON "ExtractedImage"("fileId", "relevanceScore");
