import { SmartImageData } from './smart-image-extractor'

export interface ImageRelevanceMatch {
  image: SmartImageData
  relevanceScore: number
  matchReason: string
}

/**
 * CONTEXT-AWARE IMAGE SERVER
 * Determines which images to serve based on the current chat context
 */
export class ContextAwareImageServer {
  private images: SmartImageData[]
  
  constructor(images: SmartImageData[]) {
    this.images = images
  }

  /**
   * Find relevant images for the current message/context
   */
  findRelevantImages(
    userMessage: string,
    contextText: string,
    chapterNumber?: number,
    maxImages: number = 3
  ): ImageRelevanceMatch[] {
    const matches: ImageRelevanceMatch[] = []
    
    const messageLower = userMessage.toLowerCase()
    const contextLower = contextText.toLowerCase()
    
    for (const image of this.images) {
      let score = 0
      const reasons: string[] = []
      
      // Check if user is asking about diagrams/images
      if (messageLower.includes('diagram') || messageLower.includes('figure') || 
          messageLower.includes('image') || messageLower.includes('graph') ||
          messageLower.includes('show') || messageLower.includes('illustrate')) {
        score += 30
        reasons.push('Explicitly asking for visual')
      }
      
      // Check if message mentions topics in the image
      for (const topic of image.topics) {
        if (messageLower.includes(topic.toLowerCase()) || 
            contextLower.includes(topic.toLowerCase())) {
          score += 15
          reasons.push(`Topic match: ${topic}`)
        }
      }
      
      // Check chapter match
      if (chapterNumber && image.chapterNumber === chapterNumber) {
        score += 25
        reasons.push(`Chapter ${chapterNumber} match`)
      }
      
      // Check if context mentions the same concepts as image nearby text
      const imageWords = this.extractKeyWords(image.nearbyText)
      const contextWords = this.extractKeyWords(contextText)
      const commonWords = imageWords.filter(w => contextWords.includes(w))
      
      if (commonWords.length > 0) {
        score += commonWords.length * 5
        reasons.push(`${commonWords.length} concept matches`)
      }
      
      // Check for specific terms that indicate need for visuals
      const visualTerms = [
        'how does', 'what is', 'explain', 'structure', 'process',
        'mechanism', 'circuit', 'anatomy', 'components', 'parts'
      ]
      
      for (const term of visualTerms) {
        if (messageLower.includes(term)) {
          score += 10
          reasons.push('Explanation-type question')
          break
        }
      }
      
      // Use image's inherent relevance score
      score += image.relevanceScore * 0.3
      
      if (score > 0) {
        matches.push({
          image,
          relevanceScore: score,
          matchReason: reasons.join(', ')
        })
      }
    }
    
    // Sort by relevance and return top N
    return matches
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxImages)
  }

  /**
   * Check if we should include images in the response
   */
  shouldIncludeImages(userMessage: string, relevantImages: ImageRelevanceMatch[]): boolean {
    if (relevantImages.length === 0) return false
    
    const messageLower = userMessage.toLowerCase()
    
    // Always include if explicitly asked
    if (messageLower.includes('show') || messageLower.includes('diagram') || 
        messageLower.includes('figure') || messageLower.includes('image')) {
      return true
    }
    
    // Include if highly relevant (score > 40)
    if (relevantImages[0].relevanceScore > 40) {
      return true
    }
    
    // Include for explanation-type questions with decent relevance
    const explanationTerms = ['how', 'what', 'explain', 'describe', 'illustrate']
    if (explanationTerms.some(term => messageLower.includes(term)) && 
        relevantImages[0].relevanceScore > 25) {
      return true
    }
    
    return false
  }

  /**
   * Format images for inclusion in AI response
   */
  formatImagesForResponse(matches: ImageRelevanceMatch[]): string {
    if (matches.length === 0) return ''
    
    let formatted = '\n\n**Relevant Diagrams:**\n\n'
    
    for (const match of matches) {
      const { image } = match
      formatted += `📊 **Figure from Page ${image.pageNumber}**\n`
      
      if (image.chapter) {
        formatted += `*${image.chapter}*\n`
      }
      
      if (image.topics.length > 0) {
        formatted += `Topics: ${image.topics.slice(0, 3).join(', ')}\n`
      }
      
      formatted += `![Diagram](${image.imageUrl})\n\n`
      
      if (image.nearbyText.length > 0) {
        const caption = image.nearbyText.substring(0, 150).trim()
        formatted += `*${caption}${image.nearbyText.length > 150 ? '...' : ''}*\n\n`
      }
    }
    
    return formatted
  }

  /**
   * Get image URLs only (for embedding in message metadata)
   */
  getImageUrls(matches: ImageRelevanceMatch[]): string[] {
    return matches.map(m => m.image.imageUrl)
  }

  /**
   * Extract key words from text for matching
   */
  private extractKeyWords(text: string): string[] {
    // Remove common words
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'been', 'be',
      'this', 'that', 'these', 'those', 'it', 'its', 'as', 'can', 'may'
    ])
    
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !commonWords.has(w))
    
    // Count frequencies
    const freq = new Map<string, number>()
    words.forEach(w => freq.set(w, (freq.get(w) || 0) + 1))
    
    // Return words that appear at least twice
    return Array.from(freq.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word)
  }

  /**
   * Get all images for a specific chapter
   */
  getImagesForChapter(chapterNumber: number): SmartImageData[] {
    return this.images
      .filter(img => img.chapterNumber === chapterNumber)
      .sort((a, b) => a.pageNumber - b.pageNumber)
  }

  /**
   * Get images within a page range
   */
  getImagesInRange(startPage: number, endPage: number): SmartImageData[] {
    return this.images
      .filter(img => img.pageNumber >= startPage && img.pageNumber <= endPage)
      .sort((a, b) => a.pageNumber - b.pageNumber)
  }

  /**
   * Search images by topic
   */
  searchImagesByTopic(topic: string): SmartImageData[] {
    const topicLower = topic.toLowerCase()
    return this.images
      .filter(img => 
        img.topics.some(t => t.toLowerCase().includes(topicLower)) ||
        img.nearbyText.toLowerCase().includes(topicLower) ||
        (img.chapter && img.chapter.toLowerCase().includes(topicLower))
      )
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  }
}

/**
 * Helper function to create image server from stored images
 */
export function createImageServer(images: SmartImageData[]): ContextAwareImageServer {
  return new ContextAwareImageServer(images)
}