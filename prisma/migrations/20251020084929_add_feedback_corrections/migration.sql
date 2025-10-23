-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('TOO_COMPLEX', 'INCORRECT_INFO', 'MISSING_CONTEXT', 'OFF_TOPIC', 'OTHER');

-- AlterTable
ALTER TABLE "MessageFeedback" ADD COLUMN     "correctedResponse" TEXT,
ADD COLUMN     "feedbackCategory" "FeedbackCategory";
