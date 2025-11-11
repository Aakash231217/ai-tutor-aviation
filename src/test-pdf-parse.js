const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testPDFParse() {
  try {
    // Read the PDF file
    const pdfPath = 'D:/telegram/teacher-mode/MET_IC_Joshi_7 Edition1.pdf';
    
    if (!fs.existsSync(pdfPath)) {
      console.log('PDF file not found at:', pdfPath);
      console.log('Please download the PDF first');
      return;
    }
    
    console.log('Reading PDF from:', pdfPath);
    const dataBuffer = fs.readFileSync(pdfPath);
    console.log('PDF buffer size:', dataBuffer.length);
    
    // Parse with different options
    console.log('\n--- Testing pdf-parse with default options ---');
    const data1 = await pdfParse(dataBuffer);
    console.log('Pages:', data1.numpages);
    console.log('Text length:', data1.text.length);
    console.log('First 500 chars:', data1.text.substring(0, 500));
    console.log('Info:', data1.info);
    
    // Try with specific render options
    console.log('\n--- Testing with render options ---');
    const data2 = await pdfParse(dataBuffer, {
      pagerender: function(pageData) {
        // Custom page render function
        return pageData.getTextContent()
          .then(function(textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
              if (lastY == item.transform[5] || !lastY){
                text += item.str;
              } else {
                text += '\n' + item.str;
              }
              lastY = item.transform[5];
            }
            return text;
          });
      }
    });
    console.log('Pages:', data2.numpages);
    console.log('Text length:', data2.text.length);
    console.log('First 500 chars:', data2.text.substring(0, 500));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPDFParse();