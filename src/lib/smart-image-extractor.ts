import { v2 as cloudinary } from 'cloudinary'
import { PDFDocument } from 'pdf-lib'
import pdfParse from 'pdf-parse-fork'
import { detectPagesWithImages, PageImageInfo } from './pdf-image-detector'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface SmartImageData {
  pageNumber: number
  imageUrl: string
  cloudinaryId: string
  contextBefore: string
  contextAfter: string
  nearbyText: string
  topics: string[]
  chapter?: string
  chapterNumber?: number
  relevanceScore: number // How likely this image is important
  imageCount: number // Number of images on this page
}

/**
 * SMART IMAGE EXTRACTOR
 * Only processes pages with actual images, uploads them to Cloudinary on-demand
 * Stores metadata for intelligent serving in chat
 */
export class SmartImageExtractor {
  private pdfBuffer: Buffer
  private fileId: string
  private pageCache: Map<number, Buffer> = new Map()
  
  constructor(pdfBuffer: Buffer, fileId: string) {
    this.pdfBuffer = pdfBuffer
    this.fileId = fileId
  }

  /**
   * Step 1: Detect which pages have images WITHOUT uploading anything
   */
  async detectImagePages(): Promise<PageImageInfo[]> {
    console.log('[SMART_EXTRACTOR] Detecting pages with images...')
    const pageInfo = await detectPagesWithImages(this.pdfBuffer)
    
    const pagesWithImages = pageInfo.filter(p => p.hasImages && p.imageCount > 0)
    console.log(`[SMART_EXTRACTOR] Found ${pagesWithImages.length} pages with images out of ${pageInfo.length} total pages`)
    
    return pagesWithImages
  }

  /**
   * Step 2: Extract text context for pages with images
   */
  async getPageContext(pageNumber: number, totalPages: number): Promise<{
    contextBefore: string
    contextAfter: string
    nearbyText: string
    topics: string[]
    chapter?: string
    chapterNumber?: number
  }> {
    try {
      const pdfData = await pdfParse(this.pdfBuffer)
      const fullText = pdfData.text
      
      // Calculate approximate text position for this page
      const charsPerPage = Math.floor(fullText.length / totalPages)
      const pageStart = Math.max(0, (pageNumber - 1) * charsPerPage)
      const pageEnd = Math.min(fullText.length, pageNumber * charsPerPage)
      
      // Get text before, on, and after the page
      const contextBefore = fullText.substring(Math.max(0, pageStart - 500), pageStart)
      const pageText = fullText.substring(pageStart, pageEnd)
      const contextAfter = fullText.substring(pageEnd, Math.min(fullText.length, pageEnd + 500))
      
      // Extract topics from nearby text
      const nearbyText = contextBefore + pageText + contextAfter
      const topics = this.extractTopics(nearbyText)
      
      // Try to detect chapter info
      const chapterInfo = this.detectChapter(nearbyText, pageText)
      
      return {
        contextBefore: contextBefore.trim(),
        contextAfter: contextAfter.trim(),
        nearbyText: pageText.trim(),
        topics,
        chapter: chapterInfo.title,
        chapterNumber: chapterInfo.number
      }
    } catch (error) {
      console.error(`[SMART_EXTRACTOR] Error getting context for page ${pageNumber}:`, error)
      return {
        contextBefore: '',
        contextAfter: '',
        nearbyText: '',
        topics: []
      }
    }
  }

  /**
   * Step 3: Extract and upload ONLY a specific page to Cloudinary
   */
  async extractAndUploadPage(pageNumber: number): Promise<SmartImageData | null> {
    try {
      console.log(`[SMART_EXTRACTOR] Extracting page ${pageNumber}...`)
      
      // Extract single page as separate PDF
      const singlePagePDF = await this.extractSinglePage(pageNumber)
      
      // Upload only this page to Cloudinary
      const base64Pdf = `data:application/pdf;base64,${singlePagePDF.toString('base64')}`
      
      console.log(`[SMART_EXTRACTOR] Uploading page ${pageNumber} to Cloudinary...`)
      const uploadResult = await cloudinary.uploader.upload(base64Pdf, {
        resource_type: 'image',
        format: 'pdf',
        folder: `pdf-images/${this.fileId}`,
        public_id: `page_${pageNumber}`,
        pages: true,
      })
      
      // Generate optimized image URL
      const imageUrl = cloudinary.url(uploadResult.public_id, {
        resource_type: 'image',
        format: 'png',
        page: 1, // Since we uploaded a single-page PDF
        width: 1200,
        height: 1600,
        crop: 'limit',
        quality: 'auto:good',
        dpr: 'auto',
      })
      
      // Get PDF page count for context
      const pdfDoc = await PDFDocument.load(new Uint8Array(this.pdfBuffer), { ignoreEncryption: true })
      const totalPages = pdfDoc.getPageCount()
      
      // Get context
      const context = await this.getPageContext(pageNumber, totalPages)
      
      // Calculate relevance score (higher = more important)
      const relevanceScore = this.calculateRelevanceScore(context.nearbyText, context.topics)
      
      console.log(`[SMART_EXTRACTOR] Successfully uploaded page ${pageNumber}`)
      
      return {
        pageNumber,
        imageUrl,
        cloudinaryId: uploadResult.public_id,
        contextBefore: context.contextBefore,
        contextAfter: context.contextAfter,
        nearbyText: context.nearbyText,
        topics: context.topics,
        chapter: context.chapter,
        chapterNumber: context.chapterNumber,
        relevanceScore,
        imageCount: 1 // This is per-page
      }
    } catch (error) {
      console.error(`[SMART_EXTRACTOR] Error uploading page ${pageNumber}:`, error)
      return null
    }
  }

  /**
   * Extract a single page as a separate PDF
   */
  private async extractSinglePage(pageNumber: number): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(new Uint8Array(this.pdfBuffer), { ignoreEncryption: true })
    
    // Create new PDF with just this page
    const newPdf = await PDFDocument.create()
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageNumber - 1])
    newPdf.addPage(copiedPage)
    
    const pdfBytes = await newPdf.save()
    return Buffer.from(pdfBytes)
  }

  /**
   * Extract topics from text
   */
  private extractTopics(text: string): string[] {
    const topics: string[] = []
    const lowerText = text.toLowerCase()
    
    // Common topic indicators
    const topicPatterns = [
      /(?:figure|diagram|image|illustration|graph|chart|table)\s*\d+[\.:]\s*([^\n.]{5,60})/gi,
      /(?:section|chapter|topic)\s*[\d.]+[\.:]\s*([^\n.]{5,60})/gi,
    ]
    
    for (const pattern of topicPatterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        if (match[1]) {
          topics.push(match[1].trim())
        }
      }
    }
    
    // Extract key terms (nouns that appear multiple times)
    const words = text.match(/\b[A-Z][a-z]{3,}\b/g) || []
    const wordCount = new Map<string, number>()
    
    words.forEach(word => {
      const count = wordCount.get(word) || 0
      wordCount.set(word, count + 1)
    })
    
    // Add frequently mentioned capitalized words
    Array.from(wordCount.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([word]) => topics.push(word))
    
    return [...new Set(topics)].slice(0, 10) // Return unique topics, max 10
  }

  /**
   * Detect chapter information from text
   */
  private detectChapter(nearbyText: string, pageText: string): { title?: string; number?: number } {
    const fullText = nearbyText + pageText
    
    // Try to find chapter heading
    const chapterMatch = fullText.match(/(?:chapter|unit|section)\s*(\d+)[\.:]\s*([^\n.]{5,80})/i)
    
    if (chapterMatch) {
      return {
        number: parseInt(chapterMatch[1]),
        title: chapterMatch[2].trim()
      }
    }
    
    return {}
  }

  /**
   * Calculate how relevant/important this page's image is
   */
  private calculateRelevanceScore(text: string, topics: string[]): number {
    let score = 50 // Base score
    
    const lowerText = text.toLowerCase()
    
    // Boost score for certain keywords
    if (lowerText.includes('figure') || lowerText.includes('diagram')) score += 20
    if (lowerText.includes('important') || lowerText.includes('key concept')) score += 15
    if (lowerText.includes('example') || lowerText.includes('illustration')) score += 10
    if (lowerText.includes('graph') || lowerText.includes('chart')) score += 15
    if (lowerText.includes('formula') || lowerText.includes('equation')) score += 10
    
    // Boost based on number of topics
    score += Math.min(topics.length * 5, 20)
    
    return Math.min(score, 100)
  }

  /**
   * Main method: Process only high-priority pages with images
   */
  async processSmartExtraction(maxPages: number = 20): Promise<SmartImageData[]> {
    console.log('[SMART_EXTRACTOR] Starting smart image extraction...')
    
    // Step 1: Detect pages with images
    const pagesWithImages = await this.detectImagePages()
    
    if (pagesWithImages.length === 0) {
      console.log('[SMART_EXTRACTOR] No pages with images found')
      return []
    }
    
    // Step 2: Sort by relevance (pages with more images first)
    const sortedPages = pagesWithImages
      .sort((a, b) => b.imageCount - a.imageCount)
      .slice(0, maxPages) // Only process top N pages
    
    console.log(`[SMART_EXTRACTOR] Will process ${sortedPages.length} pages (out of ${pagesWithImages.length} total)`)
    
    // Step 3: Extract and upload only these pages
    const results: SmartImageData[] = []
    
    for (const pageInfo of sortedPages) {
      const imageData = await this.extractAndUploadPage(pageInfo.pageNumber)
      if (imageData) {
        results.push({
          ...imageData,
          imageCount: pageInfo.imageCount
        })
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore)
    
    console.log(`[SMART_EXTRACTOR] Successfully extracted ${results.length} images`)
    return results
  }

  /**
   * Clean up Cloudinary resources for this file
   */
  async cleanup(): Promise<void> {
    try {
      console.log(`[SMART_EXTRACTOR] Cleaning up Cloudinary resources for file ${this.fileId}`)
      await cloudinary.api.delete_resources_by_prefix(`pdf-images/${this.fileId}/`)
    } catch (error) {
      console.error('[SMART_EXTRACTOR] Cleanup error:', error)
    }
  }
}

/**
 * Helper function to use the smart extractor
 */
export async function extractImagesSmartly(
  pdfBuffer: Buffer,
  fileId: string,
  maxPages: number = 20
): Promise<SmartImageData[]> {
  const extractor = new SmartImageExtractor(pdfBuffer, fileId)
  return await extractor.processSmartExtraction(maxPages)
}