import pdfParse from 'pdf-parse-fork'
import { PDFDocument } from 'pdf-lib'

// Completely suppress all console warnings during PDF parsing
const suppressAllWarnings = () => {
  const noop = () => {}
  const original = {
    warn: console.warn,
    error: console.error,
    log: console.log
  }
  
  console.warn = noop
  // Don't suppress errors, only warnings
  
  return () => {
    console.warn = original.warn
    console.error = original.error
    console.log = original.log
  }
}

// Enhanced PDF text extraction that handles various PDF types
export async function extractTextFromPDFEnhanced(pdfBuffer: Buffer): Promise<{
  text: string
  pageCount: number
  pageTexts: string[]
}> {
  console.log('[PDF_PARSER] Starting enhanced text extraction...')
  
  // Suppress all warnings during parsing
  const restoreConsole = suppressAllWarnings()
  
  // Try with pdf-parse first
  try {
    const data = await pdfParse(pdfBuffer, {
      // Options to handle OCR'd PDFs better
      max: 0 // Parse all pages
    })
    
    // Restore console after parsing
    restoreConsole()
    
    console.log(`[PDF_PARSER] pdf-parse extracted ${data.text.length} characters from ${data.numpages} pages`)
    
    // Clean up the text to handle OCR artifacts
    const cleanedText = data.text
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[\x00-\x1F\x7F-\x9F]/g, ' ') // Remove control characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // Split by form feed or double newlines for page detection
    const pageTexts = cleanedText
      .split(/\f|\n\n\n+/)
      .map(t => t.trim())
      .filter(t => t.length > 0)
    
    // If no clear page breaks, create artificial ones
    if (pageTexts.length === 1 && data.numpages > 1) {
      const avgCharsPerPage = Math.ceil(cleanedText.length / data.numpages)
      const artificialPages: string[] = []
      for (let i = 0; i < data.numpages; i++) {
        const start = i * avgCharsPerPage
        const end = Math.min((i + 1) * avgCharsPerPage, cleanedText.length)
        artificialPages.push(cleanedText.substring(start, end))
      }
      return {
        text: cleanedText,
        pageCount: data.numpages,
        pageTexts: artificialPages
      }
    }
    
    // Return the extracted data
    return {
      text: cleanedText,
      pageCount: data.numpages,
      pageTexts: pageTexts
    }
  } catch (error) {
    restoreConsole()
    console.error('[PDF_PARSER] pdf-parse failed:', error)
    
    // Fallback: try to at least get page count
    try {
      const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBuffer))
      const pageCount = pdfDoc.getPageCount()
      console.log(`[PDF_PARSER] PDF has ${pageCount} pages but text extraction failed`)
      
      return {
        text: '',
        pageCount: pageCount,
        pageTexts: []
      }
    } catch (finalError) {
      console.error('[PDF_PARSER] All extraction methods failed:', finalError)
      return {
        text: '',
        pageCount: 0,
        pageTexts: []
      }
    }
  }
}

// Check if a PDF is text-based or image-based
export async function analyzePDFContent(pdfBuffer: Buffer): Promise<{
  isTextBased: boolean
  isImageBased: boolean
  needsOCR: boolean
  pageCount: number
  avgCharsPerPage: number
}> {
  const { text, pageCount } = await extractTextFromPDFEnhanced(pdfBuffer)
  const avgCharsPerPage = pageCount > 0 ? text.length / pageCount : 0
  
  // A text-based PDF should have at least 100 characters per page on average
  const isTextBased = avgCharsPerPage > 100
  const isImageBased = avgCharsPerPage < 50
  const needsOCR = isImageBased && pageCount > 0
  
  console.log('[PDF_PARSER] PDF Analysis:', {
    pageCount,
    totalChars: text.length,
    avgCharsPerPage: avgCharsPerPage.toFixed(1),
    isTextBased,
    isImageBased,
    needsOCR
  })
  
  return {
    isTextBased,
    isImageBased,
    needsOCR,
    pageCount,
    avgCharsPerPage
  }
}