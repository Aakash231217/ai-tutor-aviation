import { db } from '@/db'
import { getPineconeClient } from '@/lib/pinecone'
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { NextRequest } from 'next/server'
import { StreamingTextResponse } from 'ai'
import { OpenAI } from 'openai'
import { teachingSessionManager } from '@/lib/teaching-session'

// Helper function to generate quiz questions for a chapter
async function generateQuizQuestions(chapterContent: string, chapterNumber: number, fileId: string) {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-2025-08-07',
    messages: [
      {
        role: 'system',
        content: 'You are an expert educator creating quiz questions. Generate exactly 10 multiple-choice questions based on the chapter content. Each question should test understanding of key concepts. Format your response as a JSON object with a "questions" array. Each question object must have: question (string), options (array of exactly 4 option strings), correctAnswer (the correct option text exactly as it appears in options), explanation (brief explanation why this is correct), and difficulty (easy/medium/hard). Make questions clear and concise. Mix difficulty levels.'
      },
      {
        role: 'user',
        content: `Create 10 quiz questions for Chapter ${chapterNumber} based on this content:\n\n${chapterContent.substring(0, 4000)}...`
      }
    ],
    response_format: { type: "json_object" }
  })

  const quizData = JSON.parse(response.choices[0].message.content || '{"questions":[]}')
  
  // Save quiz questions to database
  for (const q of quizData.questions || []) {
    await db.quizQuestion.create({
      data: {
        fileId,
        chapterNumber,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty || 'medium'
      }
    })
  }
}

// Helper function to get or create student progress
async function getOrCreateProgress(fileId: string) {
  let progress = await db.studentProgress.findUnique({
    where: { fileId }
  })

  if (!progress) {
    progress = await db.studentProgress.create({
      data: { fileId }
    })
  }

  return progress
}

// Helper function to determine the teaching response type
function determineResponseType(message: string, progress: any, context: any = {}) {
  const lowerMessage = message.toLowerCase()
  
  // Check if we're in quiz mode - PRIORITY CHECK
  if (context.isQuizMode) {
    // Check if user is trying to exit quiz
    if (lowerMessage.match(/stop|quit|exit|cancel|end quiz/)) {
      return 'quiz_exit'
    }
    // Otherwise, treat as quiz answer
    return 'quiz_answer'
  }
  
  // Check for quiz answer patterns even if not in quiz mode (in case state was lost)
  if (lowerMessage.match(/^[a-d]$/i) || 
      lowerMessage.match(/^(1|2|3|4)\.\s*(no|nc|yes|maybe|[a-d])/i) ||
      lowerMessage.match(/^(no|nc|yes|maybe)$/i)) {
    return 'quiz_answer'
  }
  
  // Check for greetings
  if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return 'greeting'
  }
  
  // Check for readiness confirmations
  if (lowerMessage.match(/^(yes|yeah|sure|ok|okay|ready|let's go|let's start|i'm ready|i am ready)$/)) {
    return 'ready'
  }
  
  // Check for chapter navigation
  if (lowerMessage.match(/chapter|next chapter|previous chapter|go to chapter/)) {
    return 'chapter_navigation'
  }
  
  // Check for quiz-related
  if (lowerMessage.match(/quiz|test|questions|practice/)) {
    return 'quiz_request'
  }
  
  // Check for chapter completion
  if (lowerMessage.match(/finish.*chapter|complete.*chapter|done.*chapter|end.*chapter/)) {
    return 'chapter_complete'
  }
  
  // Check for understanding confirmation
  if (lowerMessage.match(/^(yes|no|not really|i understand|got it|clear|confused)$/)) {
    return 'understanding_check'
  }
  
  // Default to question
  return 'question'
}

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { fileId, message } = SendMessageValidator.parse(body)

    const file = await db.file.findFirst({
      where: { id: fileId },
    })

    if (!file) return new Response('Not found', { status: 404 })

    // Get student progress
    const progress = await getOrCreateProgress(fileId)
    
    // Get chapters
    const chapters = await db.chapter.findMany({
      where: { fileId },
      include: { topics: true },
      orderBy: { chapterNumber: 'asc' }
    })

    // Save user message
    await db.message.create({
      data: {
        text: message,
        isUserMessage: true,
        fileId,
      },
    })

    // Get or create teaching session
    let session = teachingSessionManager.getSession(fileId)
    if (!session) {
      session = teachingSessionManager.createSession(fileId)
    }
    
    // Determine response type
    const responseType = determineResponseType(message, progress, { isQuizMode: session.isQuizMode })
    
    console.log('[TEACHER_CHAT] Session state:', {
      fileId,
      isQuizMode: session.isQuizMode,
      responseType,
      message: message.substring(0, 50)
    })
    
    // Get previous messages for context
    const prevMessages = await db.message.findMany({
      where: { fileId },
      orderBy: { createdAt: 'desc' },
      take: 20, // Increased to maintain better context
    }).then(messages => messages.reverse()) // Reverse to get chronological order

    const formattedPrevMessages = prevMessages.map((msg) => ({
      role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
      content: msg.text,
    }))

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    let systemPrompt = ''
    let userPrompt = ''
    let needsVectorSearch = false

    // Handle different response types
    switch (responseType) {
      case 'greeting':
        if (progress.isFirstTime) {
          systemPrompt = `You are a friendly and encouraging teacher. The student just opened the book for the first time. Greet them warmly and ask if they're ready to tackle the challenges ahead. Keep it brief and motivating.`
          userPrompt = message
        } else {
          const lastChapter = progress.currentChapter
          systemPrompt = `You are a friendly teacher welcoming back a returning student. They last worked on Chapter ${lastChapter}. Greet them and ask if they want to continue from where they left off or review. Keep it brief and encouraging.`
          userPrompt = message
        }
        break

      case 'ready':
        if (progress.isFirstTime && chapters.length > 0) {
          // First time and ready to start
          await db.studentProgress.update({
            where: { id: progress.id },
            data: { isFirstTime: false }
          })
          
          systemPrompt = `You are an enthusiastic teacher. The student is ready to begin learning. List all the chapters available in the book and tell them you'll be starting with Chapter 1. Ask if they're ready to begin. Format the chapter list clearly.`
          userPrompt = `Student said: ${message}\n\nAvailable chapters:\n${chapters.map(ch => `Chapter ${ch.chapterNumber}: ${ch.title}`).join('\n')}`
        } else if (!progress.isFirstTime && progress.completedChapters.length === 0) {
          // Ready to start Chapter 1
          systemPrompt = `You are an engaging teacher about to start teaching Chapter 1. Give a brief overview of what the chapter covers and start explaining the key concepts. Be clear, structured, and engaging. After explaining the main points, ask if they have any questions.`
          const chapter1 = chapters.find(ch => ch.chapterNumber === 1)
          if (chapter1) {
            userPrompt = `Student is ready to start Chapter 1: ${chapter1.title}\n\nChapter content preview: ${chapter1.content.substring(0, 1000)}...`
            needsVectorSearch = true
          }
        } else {
          // Ready for next chapter
          const nextChapter = progress.currentChapter + 1
          const chapter = chapters.find(ch => ch.chapterNumber === nextChapter)
          if (chapter) {
            systemPrompt = `You are an engaging teacher starting Chapter ${nextChapter}. Give a brief overview and start teaching the key concepts. Be structured and clear.`
            userPrompt = `Student is ready for Chapter ${nextChapter}: ${chapter.title}`
            needsVectorSearch = true
          }
        }
        break

      case 'question':
        // Regular question - use vector search
        needsVectorSearch = true
        systemPrompt = `You are a helpful teacher answering a student's question. Use the provided context to give a clear, accurate answer. After answering, always ask "Did you understand?" or "Do you have any other questions about this?" to check their understanding. If the question seems related to the current chapter (${progress.currentChapter}), focus on that content.`
        break

      case 'understanding_check':
        const lastAssistantMessage = prevMessages.filter(m => !m.isUserMessage).pop()
        if (message.toLowerCase().includes('no') || message.toLowerCase().includes('confused')) {
          systemPrompt = `You are a patient teacher. The student didn't understand your last explanation. Rephrase it in simpler terms with examples. Be encouraging.`
          userPrompt = `Student said: ${message}\n\nYour last explanation was: ${lastAssistantMessage?.text || 'N/A'}`
        } else {
          // They understood - suggest a short topic quiz
          const currentChapter = chapters.find(ch => ch.chapterNumber === progress.currentChapter)
          if (currentChapter) {
            // Update session to track teaching progress
            teachingSessionManager.updateSession(fileId, { teachingPhase: 'teaching' })
            
            systemPrompt = `You are a teacher who just finished explaining a topic. The student understood it well. Suggest taking a short 3-4 question quiz on this specific topic to reinforce their understanding before moving to the next topic. Be encouraging and mention this is just for practice.`
            userPrompt = `Student understood the topic in Chapter ${currentChapter.chapterNumber}: ${currentChapter.title}`
            
            // Check if quiz questions exist for this chapter
            const existingQuiz = await db.quizQuestion.findFirst({
              where: { fileId, chapterNumber: progress.currentChapter }
            })
            
            if (!existingQuiz && currentChapter.content) {
              // Generate quiz questions in the background
              generateQuizQuestions(currentChapter.content, progress.currentChapter, fileId)
            }
          }
        }
        break

      case 'quiz_request':
        // Check if this is a short topic quiz or chapter-end quiz
        const isShortQuiz = message.toLowerCase().includes('short quiz') || message.toLowerCase().includes('topic')
        const numQuestions = isShortQuiz ? 4 : 10
        
        // First check if we already have questions
        let quizQuestions = await db.quizQuestion.findMany({
          where: { fileId, chapterNumber: progress.currentChapter },
          take: numQuestions
        })
        
        if (quizQuestions.length === 0) {
          // Generate questions immediately
          const currentChapter = chapters.find(ch => ch.chapterNumber === progress.currentChapter)
          if (currentChapter?.content) {
            // Generate and wait for questions
            await generateQuizQuestions(currentChapter.content, progress.currentChapter, fileId)
            
            // Fetch the newly generated questions
            quizQuestions = await db.quizQuestion.findMany({
              where: { fileId, chapterNumber: progress.currentChapter },
              take: numQuestions
            })
          }
        }
        
        if (quizQuestions.length > 0) {
          // Start quiz session
          teachingSessionManager.startQuiz(fileId, progress.currentChapter, quizQuestions.slice(0, numQuestions))
          const firstQuestion = teachingSessionManager.getCurrentQuestion(fileId)
          
          if (firstQuestion) {
            const options = firstQuestion.options as string[]
            systemPrompt = `You are a friendly teacher starting a ${isShortQuiz ? 'short topic quiz' : 'chapter-end quiz'}. Present the question clearly and encouragingly.`
            userPrompt = `Present this quiz question:\n\nQuestion 1 of ${numQuestions}:\n${firstQuestion.question}\n\nA) ${options[0]}\nB) ${options[1]}\nC) ${options[2]}\nD) ${options[3]}\n\nTell the student to answer with just the letter (A, B, C, or D).`
          }
        } else {
          systemPrompt = `You are a teacher. Apologize that the quiz isn't ready yet and suggest reviewing the chapter content.`
          userPrompt = message
        }
        break

      case 'quiz_exit':
        // End the quiz session
        teachingSessionManager.updateSession(fileId, { isQuizMode: false })
        systemPrompt = `You are a teacher. The student wants to stop the quiz. Acknowledge this and ask what they'd like to do next - continue learning, review topics, or take a break.`
        userPrompt = `Student wants to exit the quiz`
        break

      case 'chapter_complete':
        systemPrompt = `You are a teacher who has finished teaching all topics in the chapter. It's time for the comprehensive chapter-end quiz. Tell the student they've completed all topics and now need to take a final quiz with 8-10 questions. They need to score at least 80% to proceed to the next chapter. Be encouraging!`
        userPrompt = `Student indicated they've finished Chapter ${progress.currentChapter}`
        break

      case 'quiz_answer':
        try {
          // Extract answer from various formats (e.g., "1. NO 2. NC 3. NO" or just "A")
          let answer = message.trim().toUpperCase()
          
          // Check if it's a multi-answer format
          const multiAnswerMatch = message.match(/[1-3]\.\s*([A-D]|NO|NC)/gi)
          if (multiAnswerMatch && multiAnswerMatch.length > 0) {
            // For now, take the first answer in multi-answer format
            answer = multiAnswerMatch[0].replace(/[1-3]\.\s*/i, '').trim().toUpperCase()
          }
          
          // Map common answer formats to A/B/C/D
          const answerMap: { [key: string]: string } = {
            'NO': 'A', 'NC': 'B', 'YES': 'C', 'MAYBE': 'D'
          }
          
          if (answerMap[answer]) {
            answer = answerMap[answer]
          }
          
          const result = teachingSessionManager.submitAnswer(fileId, answer)
          
          if (result.isQuizComplete) {
            const quizResults = teachingSessionManager.getQuizResults(fileId)
            
            // Update student progress with quiz score
            const updateData: any = {
              quizScores: {
                ...(progress.quizScores as any || {}),
                [progress.currentChapter]: quizResults?.percentage || 0
              }
            }
            
            // If score is above 80%, mark chapter as completed
            if (quizResults && quizResults.percentage >= 80) {
              if (!progress.completedChapters.includes(progress.currentChapter)) {
                updateData.completedChapters = {
                  push: progress.currentChapter
                }
              }
              // Move to next chapter
              if (progress.currentChapter < chapters.length) {
                updateData.currentChapter = progress.currentChapter + 1
              }
            }
            
            await db.studentProgress.update({
              where: { id: progress.id },
              data: updateData
            })
            
            const isShortQuiz = quizResults && quizResults.total <= 4
            
            if (isShortQuiz) {
              // Short topic quiz completed
              systemPrompt = `You are a teacher who just finished a short topic quiz. The student scored ${quizResults?.score} out of ${quizResults?.total}. Give brief feedback and then continue teaching the next topic in the chapter. If all topics are covered, suggest taking the comprehensive chapter-end quiz (8-10 questions).`
              userPrompt = `Topic quiz completed! Score: ${quizResults?.score}/${quizResults?.total}`
            } else {
              // Chapter-end quiz completed
              systemPrompt = `You are a teacher who just finished the chapter-end quiz. The student scored ${quizResults?.score} out of ${quizResults?.total} (${quizResults?.percentage}%). ${quizResults?.percentage && quizResults.percentage >= 80 ? 'Excellent work! Congratulate them and ask if they are ready to move to the next chapter.' : 'Encourage them and suggest reviewing the topics they struggled with before retaking the quiz. They need 80% or higher to proceed to the next chapter.'}`
              userPrompt = `Chapter quiz completed! Score: ${quizResults?.score}/${quizResults?.total} (${quizResults?.percentage}%)`
            }
          } else {
            const nextQuestion = teachingSessionManager.getCurrentQuestion(fileId)
            const session = teachingSessionManager.getSession(fileId)
            const questionNum = session?.quizSession?.currentQuestionIndex || 1
            const totalQuestions = session?.quizSession?.questions.length || 10
            const options = nextQuestion.options as string[]
            
            systemPrompt = `You are a teacher grading a quiz answer. The answer was ${result.isCorrect ? 'correct' : 'incorrect'}. ${result.isCorrect ? 'Praise them briefly' : 'Explain why their answer was wrong briefly'}. Then present the next question clearly.`
            userPrompt = `Answer: ${result.isCorrect ? '✓ Correct!' : '✗ Incorrect'}\n${!result.isCorrect ? `The correct answer was: ${result.explanation}` : ''}\n\nQuestion ${questionNum} of ${totalQuestions}:\n${nextQuestion.question}\n\nA) ${options[0]}\nB) ${options[1]}\nC) ${options[2]}\nD) ${options[3]}`
          }
        } catch (error) {
          systemPrompt = `You are a teacher. The student seems to have given an invalid answer or there was an issue. Ask them to answer with just the letter (A, B, C, or D).`
          userPrompt = `Invalid answer format: ${message}`
        }
        break

      default:
        needsVectorSearch = true
    }

    // Perform vector search if needed
    let contextWithPages = ''
    let images: any[] = []
    
    if (needsVectorSearch) {
      const embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      })

      const pinecone = await getPineconeClient()
      const pineconeIndex = pinecone.Index('quill')

      const queryEmbedding = await embeddings.embedQuery(message)
      
      const queryResponse = await pineconeIndex
        .namespace(file.id)
        .query({
          vector: queryEmbedding,
          topK: 5,
          includeMetadata: true,
        })

      const results = queryResponse.matches?.map((match) => ({
        pageContent: match.metadata?.text || '',
        metadata: {
          pageNumber: match.metadata?.pageNumber,
          score: match.score,
        },
      })) || []

      contextWithPages = results.map((r) => {
        const pageNum = r.metadata.pageNumber ? `[Page ${r.metadata.pageNumber}]` : '[Page unknown]'
        return `${pageNum} ${r.pageContent}`
      }).join('\n\n')
    }

    // Update last interaction
    await db.studentProgress.update({
      where: { id: progress.id },
      data: { lastInteraction: new Date() }
    })

    // Add quiz context to system prompt if in quiz mode
    let enhancedSystemPrompt = systemPrompt || 'You are a helpful and encouraging teacher. Answer based on the provided context.'
    
    if (session.isQuizMode && session.quizSession) {
      const currentQ = session.quizSession.currentQuestionIndex
      const totalQ = session.quizSession.questions.length
      enhancedSystemPrompt = `${systemPrompt} Remember: You are currently conducting a quiz. This is question ${currentQ} of ${totalQ}. Stay focused on the quiz and don't start a new topic or conversation.`
    }
    
    // Create the chat completion
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-2025-08-07',
      stream: true,
      messages: [
        {
          role: 'system',
          content: enhancedSystemPrompt
        },
        {
          role: 'user',
          content: userPrompt || `Answer this question based on the context: ${message}\n\nContext:\n${contextWithPages}\n\nPrevious conversation:\n${formattedPrevMessages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}`
        },
      ],
    })

    // Convert the response into a readable stream
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || ''
            fullResponse += content
            
            const bytes = new TextEncoder().encode(content)
            controller.enqueue(bytes)
          }
          
          // Save the complete message
          await db.message.create({
            data: {
              text: fullResponse,
              isUserMessage: false,
              fileId,
            },
          })
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'X-Progress-Data': JSON.stringify({
          currentChapter: progress.currentChapter,
          completedChapters: progress.completedChapters,
          isFirstTime: progress.isFirstTime
        }),
      },
    })
  } catch (error) {
    console.error('[TEACHER_CHAT_ERROR]', error)
    return new Response('Internal error', { status: 500 })
  }
}
