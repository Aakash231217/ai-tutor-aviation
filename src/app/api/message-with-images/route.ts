import { db } from '@/db'
import { getPineconeClient } from '@/lib/pinecone'
import { SendMessageValidator } from '@/lib/validators/SendMessageValidator'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { NextRequest } from 'next/server'
import { StreamingTextResponse } from 'ai'
import { OpenAI } from 'openai'
import { ContextAwareImageServer, createImageServer } from '@/lib/context-aware-image-server'
import { SmartImageData } from '@/lib/smart-image-extractor'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json()
    const { fileId, message } = SendMessageValidator.parse(body)

    const file = await db.file.findFirst({
      where: {
        id: fileId,
      },
    })

    if (!file) return new Response('Not found', { status: 404 })

    // Fetch chapters
    const chapters = await db.chapter.findMany({
      where: {
        fileId: fileId,
      },
      include: {
        topics: true,
      },
      orderBy: {
        chapterNumber: 'asc',
      },
    })

    // Fetch extracted images with metadata
    const extractedImages = await db.extractedImage.findMany({
      where: {
        fileId: fileId,
      },
      orderBy: {
        relevanceScore: 'desc',
      },
    })

    console.log(`[MESSAGE_WITH_IMAGES] Found ${extractedImages.length} images for file`)

    await db.message.create({
      data: {
        text: message,
        isUserMessage: true,
        fileId: fileId,
      },
    })

    // 1. vectorize message
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    })

    const pinecone = await getPineconeClient()
    const pineconeIndex = pinecone.Index('quill')

    const vectorStore = await pinecone.Index('quill')
    const results = await vectorStore.query({
      vector: await embeddings.embedQuery(message),
      topK: 4,
      filter: {
        fileId: fileId,
      },
      includeMetadata: true,
    })

    // Get previous messages for context
    const prevMessages = await db.message.findMany({
      where: {
        fileId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 6,
    })

    const formattedPrevMessages = prevMessages.map((msg) => ({
      role: msg.isUserMessage ? ('user' as const) : ('assistant' as const),
      content: msg.text,
    }))

    // Extract context text from Pinecone results
    const contextText = results.matches
      .map((match) => match.metadata?.text || '')
      .join('\n\n')

    // Detect current chapter if mentioned
    const chapterNumberMatch = message.match(/chapter\s*(\d+)/i)
    const currentChapter = chapterNumberMatch
      ? parseInt(chapterNumberMatch[1])
      : undefined

    // CREATE IMAGE SERVER - This decides which images to show
    const imageServer = createImageServer(
      extractedImages.map((img) => ({
        pageNumber: img.pageNumber,
        imageUrl: img.imageUrl,
        cloudinaryId: img.cloudinaryId || img.imageKey,
        contextBefore: img.contextBefore,
        contextAfter: img.contextAfter,
        nearbyText: img.nearbyText,
        topics: img.topics,
        chapter: img.chapter || undefined,
        chapterNumber: img.chapterNumber || undefined,
        relevanceScore: img.relevanceScore,
        imageCount: img.imageCount,
      }))
    )

    // Find relevant images for this specific query
    const relevantImages = imageServer.findRelevantImages(
      message,
      contextText,
      currentChapter,
      3 // Max 3 images per response
    )

    console.log(`[MESSAGE_WITH_IMAGES] Found ${relevantImages.length} relevant images`)
    relevantImages.forEach((match) => {
      console.log(
        `  - Page ${match.image.pageNumber}: Score ${match.relevanceScore.toFixed(1)} - ${match.matchReason}`
      )
    })

    // Decide if we should include images
    const shouldIncludeImages = imageServer.shouldIncludeImages(
      message,
      relevantImages
    )

    // Format images for AI response
    let imageContext = ''
    let imageUrls: string[] = []
    
    if (shouldIncludeImages && relevantImages.length > 0) {
      imageContext = '\n\n**AVAILABLE DIAGRAMS:**\n'
      relevantImages.forEach((match, index) => {
        const img = match.image
        imageContext += `\nDiagram ${index + 1} (Page ${img.pageNumber}):\n`
        if (img.chapter) imageContext += `Chapter: ${img.chapter}\n`
        if (img.topics.length > 0)
          imageContext += `Topics: ${img.topics.slice(0, 3).join(', ')}\n`
        imageContext += `Context: ${img.nearbyText.substring(0, 200)}...\n`
        imageContext += `Image URL: ${img.imageUrl}\n`
      })
      
      imageUrls = imageServer.getImageUrls(relevantImages)
      
      console.log('[MESSAGE_WITH_IMAGES] Including images in response')
    }

    // Build system prompt
    let systemPrompt = `You are a helpful AI tutor. Use the following context to answer the question.

CONTEXT FROM PDF:
${contextText}

${imageContext}

If relevant diagrams are available above, reference them in your answer using markdown image syntax:
![Description](URL)

Be specific and educational. If a diagram helps explain your answer, include it.`

    // Add chapter info if relevant
    if (currentChapter && chapters.length > 0) {
      const chapter = chapters.find((ch) => ch.chapterNumber === currentChapter)
      if (chapter) {
        systemPrompt += `\n\nCurrent Chapter: ${chapter.chapterNumber} - ${chapter.title}`
      }
    }

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      stream: true,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...formattedPrevMessages,
        {
          role: 'user',
          content: message,
        },
      ],
    })

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        try {
          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content || ''
            controller.enqueue(encoder.encode(text))
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    // Save AI response to database (after streaming)
    // Note: You'll need to capture the full response text
    // For now, we'll save a placeholder
    setTimeout(async () => {
      try {
        await db.message.create({
          data: {
            text: '[Streaming response completed]',
            isUserMessage: false,
            fileId: fileId,
          },
        })
      } catch (error) {
        console.error('[MESSAGE_WITH_IMAGES] Error saving response:', error)
      }
    }, 100)

    return new StreamingTextResponse(stream)
  } catch (error) {
    console.error('[MESSAGE_WITH_IMAGES] Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}