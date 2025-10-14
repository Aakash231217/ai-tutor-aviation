import {
  privateProcedure,
  publicProcedure,
  router,
} from './trpc'
import { TRPCError } from '@trpc/server'
import { db } from '@/db'
import { z } from 'zod'
import { INFINITE_QUERY_LIMIT } from '@/config/infinite-query'
import { ChapterExtractor } from '@/lib/chapter-extractor'

export const appRouter = router({
  getUserFiles: publicProcedure.query(async () => {
    return await db.file.findMany()
  }),

  getFileMessages: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).nullish(),
        cursor: z.string().nullish(),
        fileId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { fileId, cursor } = input
      const limit = input.limit ?? INFINITE_QUERY_LIMIT

      const file = await db.file.findFirst({
        where: {
          id: fileId,
        },
      })

      if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

      const messages = await db.message.findMany({
        take: limit + 1,
        where: {
          fileId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          isUserMessage: true,
          createdAt: true,
          text: true,
        },
      })

      let nextCursor: typeof cursor | undefined = undefined
      if (messages.length > limit) {
        const nextItem = messages.pop()
        nextCursor = nextItem?.id
      }

      return {
        messages,
        nextCursor,
      }
    }),

  getFileUploadStatus: publicProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.fileId,
        },
      })

      if (!file) return { status: 'PENDING' as const }

      return { status: file.uploadStatus }
    }),

  getFile: publicProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ input }) => {
      const file = await db.file.findFirst({
        where: {
          key: input.key,
        },
      })

      if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

      return file
    }),

  deleteFile: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const file = await db.file.findFirst({
        where: {
          id: input.id,
        },
      })

      if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

      await db.file.delete({
        where: {
          id: input.id,
        },
      })

      return file
    }),

  // Chapter-related endpoints
  extractChapters: publicProcedure
    .input(z.object({ fileId: z.string() }))
    .mutation(async ({ input }) => {
      const file = await db.file.findFirst({
        where: { id: input.fileId },
        include: { chapters: true }
      })

      if (!file) throw new TRPCError({ code: 'NOT_FOUND' })

      // If chapters already extracted, return them
      if (file.chapters.length > 0) {
        return file.chapters
      }

      // Download and extract chapters
      const response = await fetch(file.url)
      if (!response.ok) {
        throw new TRPCError({ 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to download PDF'
        })
      }

      const buffer = Buffer.from(await response.arrayBuffer())
      const extractor = new ChapterExtractor()
      const { chapters, fullText } = await extractor.extractChaptersFromPDF(buffer)

      // Save chapters to database
      const savedChapters = await Promise.all(
        chapters.map(async (chapter) => {
          const content = extractor.extractChapterContent(fullText, chapter)
          const topics = extractor.identifyTopics(content)

          const savedChapter = await db.chapter.create({
            data: {
              fileId: file.id,
              chapterNumber: chapter.chapterNumber,
              title: chapter.title,
              content: content,
              startPage: chapter.startPage,
              endPage: chapter.endPage,
              topics: {
                create: topics.map(topic => ({
                  topicNumber: topic.topicNumber,
                  title: topic.title,
                  content: topic.content,
                  estimatedTime: topic.estimatedTime
                }))
              }
            },
            include: { topics: true }
          })

          return savedChapter
        })
      )

      return savedChapters
    }),

  getChapters: publicProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      const chapters = await db.chapter.findMany({
        where: { fileId: input.fileId },
        include: { topics: true },
        orderBy: { chapterNumber: 'asc' }
      })

      return chapters
    }),

  getChapter: publicProcedure
    .input(z.object({ chapterId: z.string() }))
    .query(async ({ input }) => {
      const chapter = await db.chapter.findUnique({
        where: { id: input.chapterId },
        include: { topics: true }
      })

      if (!chapter) throw new TRPCError({ code: 'NOT_FOUND' })

      return chapter
    }),


  // Student Progress endpoints
  getStudentProgress: publicProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input }) => {
      const progress = await db.studentProgress.findUnique({
        where: { fileId: input.fileId }
      })

      return progress
    }),

  updateStudentProgress: publicProcedure
    .input(z.object({
      fileId: z.string(),
      currentChapter: z.number().optional(),
      currentTopic: z.number().optional(),
      completedChapter: z.number().optional(),
      completedTopic: z.string().optional(),
      quizScore: z.object({
        chapter: z.number(),
        score: z.number()
      }).optional()
    }))
    .mutation(async ({ input }) => {
      const { fileId, completedChapter, completedTopic, quizScore, ...updateData } = input
      
      let progress = await db.studentProgress.findUnique({
        where: { fileId }
      })

      if (!progress) {
        progress = await db.studentProgress.create({
          data: { fileId }
        })
      }

      const updates: any = { ...updateData }
      
      if (completedChapter !== undefined) {
        updates.completedChapters = {
          push: completedChapter
        }
      }
      
      if (completedTopic !== undefined) {
        updates.completedTopics = {
          push: completedTopic
        }
      }
      
      if (quizScore) {
        const currentScores = progress.quizScores as any || {}
        currentScores[quizScore.chapter] = quizScore.score
        updates.quizScores = currentScores
      }

      const updatedProgress = await db.studentProgress.update({
        where: { id: progress.id },
        data: updates
      })

      return updatedProgress
    }),

  // Quiz endpoints
  getQuizQuestions: publicProcedure
    .input(z.object({ 
      fileId: z.string(),
      chapterNumber: z.number(),
      limit: z.number().default(10)
    }))
    .query(async ({ input }) => {
      const questions = await db.quizQuestion.findMany({
        where: { 
          fileId: input.fileId,
          chapterNumber: input.chapterNumber
        },
        take: input.limit,
        orderBy: { createdAt: 'asc' }
      })

      return questions
    }),

  generateQuizQuestions: publicProcedure
    .input(z.object({
      fileId: z.string(),
      chapterNumber: z.number()
    }))
    .mutation(async ({ input }) => {
      // Check if questions already exist
      const existing = await db.quizQuestion.findFirst({
        where: {
          fileId: input.fileId,
          chapterNumber: input.chapterNumber
        }
      })

      if (existing) {
        return { message: 'Questions already exist for this chapter' }
      }

      // Get chapter content
      const chapter = await db.chapter.findFirst({
        where: {
          fileId: input.fileId,
          chapterNumber: input.chapterNumber
        }
      })

      if (!chapter) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' })
      }

      // This will be handled by the teacher-chat route
      return { message: 'Quiz generation initiated' }
    }),
})

export type AppRouter = typeof appRouter
