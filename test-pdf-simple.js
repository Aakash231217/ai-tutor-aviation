const fs = require('fs');
const path = require('path');

// Test PDF parsing with pdf-parse-fork
async function testPDFParsing() {
  try {
    // First, let's check if there's a PDF in the pdf folder
    const pdfDir = path.join(__dirname, 'pdf');
    
    if (!fs.existsSync(pdfDir)) {
      console.log('No pdf folder found. Please create a "pdf" folder and add PDF files to test.');
      return;
    }
    
    const files = fs.readdirSync(pdfDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('No PDF files found in the pdf folder.');
      return;
    }
    
    console.log(`Found ${pdfFiles.length} PDF files. Testing the first one: ${pdfFiles[0]}`);
    
    const pdfPath = path.join(pdfDir, pdfFiles[0]);
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    console.log(`\nPDF file size: ${pdfBuffer.length} bytes`);
    
    // Test with pdf-parse-fork
    const pdfParse = require('pdf-parse-fork');
    
    console.log('\n--- Testing with pdf-parse-fork ---');
    try {
      const data = await pdfParse(pdfBuffer);
      console.log(`Pages: ${data.numpages}`);
      console.log(`Text length: ${data.text.length}`);
      console.log(`First 500 characters: ${data.text.substring(0, 500)}`);
      console.log(`PDF Version: ${data.version}`);
      console.log(`PDF Info:`, data.info);
      
      // Check if it's mostly whitespace
      const nonWhitespace = data.text.replace(/\s/g, '').length;
      console.log(`\nNon-whitespace characters: ${nonWhitespace}`);
      
      if (nonWhitespace < 50) {
        console.log('\n⚠️  WARNING: PDF contains very little text!');
        console.log('This PDF might be:');
        console.log('- A scanned image PDF (needs OCR)');
        console.log('- A PDF with embedded images');
        console.log('- A PDF with special encoding');
      }
    } catch (error) {
      console.error('Error with pdf-parse-fork:', error.message);
    }
    
    // Test with pdfjs-dist if available
    console.log('\n--- Testing with pdfjs-dist ---');
    try {
      const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
      
      // Load the PDF
      const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
      const pdfDoc = await loadingTask.promise;
      
      console.log(`Number of pages: ${pdfDoc.numPages}`);
      
      let totalText = '';
      
      // Extract text from first page
      const page = await pdfDoc.getPage(1);
      const textContent = await page.getTextContent();
      
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .trim();
      
      console.log(`Page 1 text length: ${pageText.length}`);
      console.log(`Page 1 first 500 chars: ${pageText.substring(0, 500)}`);
      
      if (pageText.length < 50) {
        console.log('\n⚠️  WARNING: pdfjs-dist also extracted very little text!');
        
        // Check for images
        const ops = await page.getOperatorList();
        let imageCount = 0;
        
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          // OPS.paintImageXObject = 85
          if (fn === 85) {
            imageCount++;
          }
        }
        
        console.log(`\nFound ${imageCount} images on page 1`);
        
        if (imageCount > 0) {
          console.log('This PDF contains images. The text might be embedded in the images (requires OCR).');
        }
      }
    } catch (error) {
      console.error('Error with pdfjs-dist:', error.message);
      console.log('Note: pdfjs-dist might not work in Node.js environment without additional setup.');
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
console.log('=== PDF Parser Test ===\n');
testPDFParsing();