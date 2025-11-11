# PDF Pre-processing Guide for Teacher Mode

This guide helps you prepare image-based PDFs (scanned documents) for uploading to Teacher Mode. Pre-processing adds a text layer that allows the system to extract and index content properly.

## What is Pre-Processing?

Pre-processing uses OCR (Optical Character Recognition) to:
- **Read** the text in your scanned images
- **Add** an invisible text layer to your PDF
- **Keep** the original appearance unchanged
- **Make** your PDF searchable and extractable

Think of it as teaching the computer to "read" your scanned pages!

## Option 1: Use Adobe Acrobat Pro
1. Open your PDF in Adobe Acrobat Pro
2. Go to Tools → Enhance Scans → Recognize Text
3. Select "In This File" 
4. Choose your language and output style
5. Click "Recognize Text"
6. Save the PDF with OCR layer

## Option 2: Use Free Online Tools
- **ILovePDF**: https://www.ilovepdf.com/ocr-pdf
  - Upload your PDF
  - Select language
  - Download OCR'd PDF
  
- **SmallPDF**: https://smallpdf.com/pdf-ocr
  - Similar process
  - Good for smaller files

## Option 3: Use Python Script Locally
```python
# install: pip install ocrmypdf
import ocrmypdf

def add_ocr_to_pdf(input_pdf, output_pdf):
    ocrmypdf.ocr(
        input_pdf,
        output_pdf,
        language='eng',  # Change to your language
        force_ocr=True,  # Force OCR even if text layer exists
        skip_text=False,
        deskew=True,     # Fix skewed scans
        clean=True,      # Clean up the image
        remove_background=True
    )

# Usage
add_ocr_to_pdf('input.pdf', 'output_with_ocr.pdf')
```

## Option 4: Use Command Line Tools
```bash
# Using OCRmyPDF (best quality)
# Install: https://ocrmypdf.readthedocs.io/en/latest/installation.html
ocrmypdf input.pdf output.pdf --force-ocr

# Using Tesseract directly with ImageMagick
# First convert PDF to images
convert -density 300 input.pdf page-%03d.png
# Then OCR each image
for f in page-*.png; do tesseract "$f" "${f%.png}" -l eng pdf; done
# Merge back to PDF
pdfunite page-*.pdf output.pdf
```

## Tips for Better OCR Results:
1. **Scan Quality**: Use at least 300 DPI for scanning
2. **Clean Images**: Remove noise, shadows, and skew
3. **Consistent Lighting**: Avoid shadows and uneven lighting
4. **Language Selection**: Choose the correct language for better accuracy
5. **Font Size**: Larger, clearer fonts give better results

## Check if Your PDF Has Text Layer:
```javascript
// Quick test to check if PDF has extractable text
const fs = require('fs');
const pdfParse = require('pdf-parse');

async function checkPDF(filename) {
  const dataBuffer = fs.readFileSync(filename);
  const data = await pdfParse(dataBuffer);
  
  console.log('Total pages:', data.numpages);
  console.log('Text length:', data.text.length);
  console.log('Has text:', data.text.trim().length > 100);
  console.log('Sample:', data.text.substring(0, 200));
}

checkPDF('your-file.pdf');
```