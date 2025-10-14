/*
  Warnings:

  - You are about to drop the `LearningSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "LearningSession" DROP CONSTRAINT "LearningSession_fileId_fkey";

-- DropTable
DROP TABLE "LearningSession";

-- CreateTable
CREATE TABLE "StudentProgress" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "currentChapter" INTEGER NOT NULL DEFAULT 1,
    "currentTopic" INTEGER,
    "completedChapters" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "completedTopics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quizScores" JSONB NOT NULL DEFAULT '{}',
    "lastInteraction" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFirstTime" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentProgress_fileId_idx" ON "StudentProgress"("fileId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgress_fileId_key" ON "StudentProgress"("fileId");

-- CreateIndex
CREATE INDEX "QuizQuestion_fileId_chapterNumber_idx" ON "QuizQuestion"("fileId", "chapterNumber");

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
