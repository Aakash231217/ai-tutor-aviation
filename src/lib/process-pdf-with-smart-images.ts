import { db } from '@/db'
import { extractImagesSmartly, SmartImageData } from './smart-image-extractor'

/**
 * Process PDF and extract images intelligently
 * Only sends pages with actual images to Cloudinary
 */
export async function processPDFWithSmartImages(
  pdfBuffer: Buffer,
  fileId: string,
  maxImages: number = 20
): Promise<{
  success: boolean
  imageCount: number
  error?: string
}> {
  try {
    console.log(`[PROCESS_PDF] Starting smart image extraction for file ${fileId}`)
    
    // Use smart extractor - only processes pages with images
    const images = await extractImagesSmartly(pdfBuffer, fileId, maxImages)
    
    console.log(`[PROCESS_PDF] Extracted ${images.length} images`)
    
    if (images.length === 0) {
      console.log('[PROCESS_PDF] No images found in PDF')
      return {
        success: true,
        imageCount: 0,
      }
    }
    
    // Store images in database with full metadata
    const savedImages = await Promise.all(
      images.map((img) =>
        db.extractedImage.create({
          data: {
            fileId: fileId,
            pageNumber: img.pageNumber,
            imageUrl: img.imageUrl,
            imageKey: img.cloudinaryId, // Use cloudinary ID as key
            cloudinaryId: img.cloudinaryId,
            contextBefore: img.contextBefore,
            contextAfter: img.contextAfter,
            nearbyText: img.nearbyText,
            topics: img.topics,
            chapter: img.chapter,
            chapterNumber: img.chapterNumber,
            relevanceScore: img.relevanceScore,
            imageCount: img.imageCount,
            imageType: 'page_render',
          },
        })
      )
    )
    
    console.log(`[PROCESS_PDF] Saved ${savedImages.length} images to database`)
    
    return {
      success: true,
      imageCount: savedImages.length,
    }
  } catch (error) {
    console.error('[PROCESS_PDF] Error processing PDF:', error)
    return {
      success: false,
      imageCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Get images for a specific file (for serving in chat)
 */
export async function getFileImages(fileId: string): Promise<SmartImageData[]> {
  const images = await db.extractedImage.findMany({
    where: {
      fileId: fileId,
    },
    orderBy: {
      relevanceScore: 'desc',
    },
  })
  
  return images.map((img) => ({
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
}

/**
 * Clean up images when file is deleted
 */
export async function cleanupFileImages(fileId: string): Promise<void> {
  try {
    console.log(`[CLEANUP] Removing images for file ${fileId}`)
    
    // Get all images
    const images = await db.extractedImage.findMany({
      where: { fileId },
      select: { cloudinaryId: true },
    })
    
    // Delete from Cloudinary
    if (images.length > 0 && images[0].cloudinaryId) {
      const { v2: cloudinary } = await import('cloudinary')
      
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      })
      
      // Delete all images from this file's folder
      await cloudinary.api.delete_resources_by_prefix(`pdf-images/${fileId}/`)
      console.log(`[CLEANUP] Deleted Cloudinary resources for file ${fileId}`)
    }
    
    // Delete from database
    await db.extractedImage.deleteMany({
      where: { fileId },
    })
    
    console.log(`[CLEANUP] Cleanup complete for file ${fileId}`)
  } catch (error) {
    console.error('[CLEANUP] Error cleaning up images:', error)
  }
}