// Script to check if a PDF needs OCR pre-processing
// Usage: node check-pdf-ocr.js yourfile.pdf

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function checkPDF(filename) {
  if (!filename) {
    console.error('Please provide a PDF filename');
    console.log('Usage: node check-pdf-ocr.js yourfile.pdf');
    process.exit(1);
  }

  if (!fs.existsSync(filename)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  console.log(`\nChecking PDF: ${filename}`);
  console.log('='.repeat(50));

  try {
    const dataBuffer = fs.readFileSync(filename);
    const fileSize = dataBuffer.length;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
    
    console.log(`File size: ${fileSizeMB} MB`);
    
    const data = await pdfParse(dataBuffer);
    
    console.log(`Total pages: ${data.numpages}`);
    console.log(`Text extracted: ${data.text.length} characters`);
    
    // Calculate average characters per page
    const avgCharsPerPage = data.text.length / data.numpages;
    console.log(`Average chars/page: ${avgCharsPerPage.toFixed(1)}`);
    
    // Count non-whitespace characters
    const nonWhitespaceChars = data.text.replace(/\s/g, '').length;
    console.log(`Non-whitespace chars: ${nonWhitespaceChars}`);
    
    // Determine if OCR is needed
    console.log('\n' + '='.repeat(50));
    
    if (avgCharsPerPage < 100 && data.numpages > 0) {
      console.log('❌ This PDF needs OCR pre-processing!');
      console.log('\nThis appears to be a scanned/image-based PDF.');
      console.log('\nRecommended actions:');
      console.log('1. Use ILovePDF.com/ocr-pdf (free online)');
      console.log('2. Use Adobe Acrobat Pro (if available)');
      console.log('3. Use OCRmyPDF command line tool');
      console.log('\nSee PDF_PREPROCESSING_GUIDE.md for detailed instructions.');
    } else {
      console.log('✅ This PDF has extractable text!');
      console.log('\nNo OCR pre-processing needed. You can upload this PDF directly.');
      
      // Show sample of extracted text
      console.log('\nSample text from PDF:');
      console.log('-'.repeat(50));
      const sampleText = data.text.trim().substring(0, 300).replace(/\n+/g, ' ');
      console.log(sampleText + '...');
    }
    
    console.log('\n');
    
  } catch (error) {
    console.error('Error reading PDF:', error.message);
    console.log('\nThis PDF might be:');
    console.log('- Password protected');
    console.log('- Corrupted');
    console.log('- Using an unsupported format');
  }
}

// Run the check
const filename = process.argv[2];
checkPDF(filename);