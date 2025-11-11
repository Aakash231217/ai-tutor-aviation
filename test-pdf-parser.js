const fs = require('fs');
const path = require('path');

// Test the PDF parser with a local file
async function testPDFParser() {
  try {
    // Import the enhanced parser
    const { extractTextFromPDFEnhanced } = await import('./src/lib/pdf-parser-enhanced.ts');
    
    // Look for test PDFs in the pdf folder
    const pdfFolder = path.join(__dirname, 'pdf');
    
    if (!fs.existsSync(pdfFolder)) {
      console.log('Creating pdf folder for test files...');
      fs.mkdirSync(pdfFolder);
      console.log('Please place your PDF files in the ./pdf folder');
      return;
    }
    
    const pdfFiles = fs.readdirSync(pdfFolder).filter(f => f.endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in ./pdf folder');
      console.log('Please place your PDF files there');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} PDF files to test\n`);
    
    for (const pdfFile of pdfFiles) {
      console.log(`\n=== Testing: ${pdfFile} ===`);
      const pdfPath = path.join(pdfFolder, pdfFile);
      const pdfBuffer = fs.readFileSync(pdfPath);
      
      console.log(`File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
      
      // Test basic pdf-parse
      try {
        const pdfParse = require('pdf-parse');
        const basicResult = await pdfParse(pdfBuffer);
        console.log('\nBasic pdf-parse results:');
        console.log(`- Pages: ${basicResult.numpages}`);
        console.log(`- Text length: ${basicResult.text.length} characters`);
        console.log(`- First 200 chars: ${basicResult.text.substring(0, 200).replace(/\n/g, ' ')}`);
      } catch (error) {
        console.error('Basic pdf-parse failed:', error.message);
      }
      
      // Test enhanced parser
      try {
        console.log('\nTesting enhanced parser...');
        const result = await extractTextFromPDFEnhanced(pdfBuffer);
        console.log('Enhanced parser results:');
        console.log(`- Pages: ${result.pageCount}`);
        console.log(`- Total text length: ${result.text.length} characters`);
        console.log(`- Page texts: ${result.pageTexts.length} pages with content`);
        console.log(`- Avg chars per page: ${(result.text.length / result.pageCount).toFixed(1)}`);
        
        if (result.text.length > 0) {
          console.log(`\nFirst 500 characters:`);
          console.log(result.text.substring(0, 500));
          
          // Show text from each page
          console.log('\nText per page:');
          result.pageTexts.forEach((pageText, i) => {
            console.log(`  Page ${i + 1}: ${pageText.length} chars - "${pageText.substring(0, 100).replace(/\n/g, ' ')}..."`);
          });
        }
      } catch (error) {
        console.error('Enhanced parser failed:', error);
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
console.log('PDF Parser Test Tool');
console.log('====================');
testPDFParser();