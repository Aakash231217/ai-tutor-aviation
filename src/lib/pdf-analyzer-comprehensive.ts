import { PDFDocument } from 'pdf-lib'
import pdfParse from 'pdf-parse-fork'

export interface ComprehensivePDFAnalysis {
  pageCount: number
  totalTextLength: number
  avgCharsPerPage: number
  isTextBased: boolean
  isImageBased: boolean
  isScannedPDF: boolean
  needsOCR: boolean
  pageAnalysis: PageAnalysis[]
}

export interface PageAnalysis {
  pageNumber: number
  textLength: number
  hasText: boolean
  estimatedImageContent: boolean
  needsOCR: boolean
}

/**
 * Comprehensive PDF analyzer that detects various PDF types including:
 * - Text-based PDFs
 * - Image-based PDFs (scanned documents)
 * - Mixed PDFs (some text, some images)
 * - PDFs with embedded images
 */
export async function analyzePDFComprehensive(pdfBuffer: Buffer): Promise<ComprehensivePDFAnalysis> {
  console.log('[PDF_ANALYZER] Starting comprehensive PDF analysis...')
  
  try {
    // Load PDF document
    const pdfDoc = await PDFDocument.load(new Uint8Array(pdfBuffer), { ignoreEncryption: true })
    const pageCount = pdfDoc.getPageCount()
    
    // Get text content
    let textData
    try {
      textData = await pdfParse(pdfBuffer)
    } catch (error) {
      console.error('[PDF_ANALYZER] Text extraction failed:', error)
      textData = { text: '', numpages: pageCount }
    }
    
    const totalTextLength = textData.text.length
    const avgCharsPerPage = pageCount > 0 ? totalTextLength / pageCount : 0
    
    console.log(`[PDF_ANALYZER] Pages: ${pageCount}, Total chars: ${totalTextLength}, Avg per page: ${avgCharsPerPage.toFixed(1)}`)
    
    // Split text by pages (form feed character)
    const pageTexts = textData.text.split(/\f/)
    
    // Analyze each page
    const pageAnalysis: PageAnalysis[] = []
    
    for (let i = 0; i < pageCount; i++) {
      const pageNum = i + 1
      const pageText = pageTexts[i] || ''
      const pageTextLength = pageText.trim().length
      
      // Heuristics to determine if page might be an image
      const hasMinimalText = pageTextLength < 50
      const hasNoText = pageTextLength === 0
      const hasOnlyWhitespace = pageText.replace(/\s/g, '').length === 0
      
      // Check page content stream size as indicator of image content
      let estimatedImageContent = false
      try {
        const page = pdfDoc.getPage(i)
        const contents = page.node.Contents()
        if (contents) {
          // Large content streams often indicate embedded images
          const contentSize = contents.toString().length
          estimatedImageContent = contentSize > 10000 && hasMinimalText
        }
      } catch (error) {
        // Ignore errors in content analysis
      }
      
      const needsOCR = (hasNoText || hasMinimalText) && estimatedImageContent
      
      pageAnalysis.push({
        pageNumber: pageNum,
        textLength: pageTextLength,
        hasText: pageTextLength > 0,
        estimatedImageContent,
        needsOCR
      })
      
      console.log(`[PDF_ANALYZER] Page ${pageNum}: ${pageTextLength} chars, image content: ${estimatedImageContent}, needs OCR: ${needsOCR}`)
    }
    
    // Determine PDF type based on analysis
    const pagesWithText = pageAnalysis.filter(p => p.textLength > 100).length
    const pagesNeedingOCR = pageAnalysis.filter(p => p.needsOCR).length
    
    const isTextBased = avgCharsPerPage > 100 && pagesWithText > pageCount * 0.5
    const isImageBased = avgCharsPerPage < 50 && pagesNeedingOCR > pageCount * 0.5
    const isScannedPDF = isImageBased || (avgCharsPerPage < 20 && pageCount > 0)
    const needsOCR = isScannedPDF || pagesNeedingOCR > 0
    
    console.log('[PDF_ANALYZER] Analysis complete:', {
      isTextBased,
      isImageBased,
      isScannedPDF,
      needsOCR,
      pagesWithText,
      pagesNeedingOCR
    })
    
    return {
      pageCount,
      totalTextLength,
      avgCharsPerPage,
      isTextBased,
      isImageBased,
      isScannedPDF,
      needsOCR,
      pageAnalysis
    }
  } catch (error) {
    console.error('[PDF_ANALYZER] Comprehensive analysis failed:', error)
    
    // Return minimal analysis on error
    return {
      pageCount: 0,
      totalTextLength: 0,
      avgCharsPerPage: 0,
      isTextBased: false,
      isImageBased: true,
      isScannedPDF: true,
      needsOCR: true,
      pageAnalysis: []
    }
  }
}

/**
 * Quick check to determine if a PDF is likely scanned/image-based
 */
export function isLikelyScannedPDF(pdfBuffer: Buffer): boolean {
  try {
    // Check file size vs expected text content
    const bufferSize = pdfBuffer.length
    const sizeInMB = bufferSize / (1024 * 1024)
    
    // Large PDFs (>2MB) with minimal text are often scanned
    if (sizeInMB > 2) {
      console.log(`[PDF_ANALYZER] Large PDF detected: ${sizeInMB.toFixed(2)}MB`)
      return true
    }
    
    return false
  } catch (error) {
    return false
  }
}