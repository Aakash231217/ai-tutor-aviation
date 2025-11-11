import fs from 'fs'
import path from 'path'
import { extractTextFromPDFEnhanced, analyzePDFContent } from './lib/pdf-parser-enhanced'

async function testPDFExtraction() {
  try {
    // Test with a local PDF file
    const testPdfPath = path.join(process.cwd(), 'test.pdf')
    
    // Check if test file exists
    if (!fs.existsSync(testPdfPath)) {
      console.log('Please place a test PDF file named "test.pdf" in the project root')
      return
    }
    
    const pdfBuffer = fs.readFileSync(testPdfPath)
    console.log(`Testing PDF extraction on file: ${testPdfPath}`)
    console.log(`File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`)
    
    // Test enhanced extraction
    console.log('\n=== Testing Enhanced Text Extraction ===')
    const result = await extractTextFromPDFEnhanced(pdfBuffer)
    
    console.log(`\nExtraction Results:`)
    console.log(`- Total pages: ${result.pageCount}`)
    console.log(`- Total text length: ${result.text.length} characters`)
    console.log(`- Pages with text: ${result.pageTexts.length}`)
    
    // Show first 500 characters of extracted text
    console.log(`\nFirst 500 characters of extracted text:`)
    console.log('---')
    console.log(result.text.substring(0, 500))
    console.log('---')
    
    // Analyze PDF content
    console.log('\n=== Analyzing PDF Content ===')
    const analysis = await analyzePDFContent(pdfBuffer)
    console.log('Analysis results:', analysis)
    
    // Show text from each page
    console.log('\n=== Text from each page ===')
    result.pageTexts.forEach((pageText, index) => {
      console.log(`\nPage ${index + 1}: ${pageText.length} characters`)
      if (pageText.length > 0) {
        console.log(pageText.substring(0, 200) + '...')
      }
    })
    
  } catch (error) {
    console.error('Error testing PDF extraction:', error)
  }
}

// Run the test
testPDFExtraction()