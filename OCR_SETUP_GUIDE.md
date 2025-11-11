# OCR Pre-Processing Guide for Teacher Mode

Since image-based PDFs (scanned documents) cannot have their text extracted directly, you need to pre-process them with OCR before uploading to Teacher Mode.

## Why Pre-Processing?

- Cloud OCR APIs have limitations (page limits, file size limits, costs)
- Pre-processed PDFs work better with the system
- One-time processing gives permanent results
- Better quality control over the OCR output

## Quick Pre-Processing Options

### Option 1: Free Online Tools (Easiest)

#### ILovePDF (Recommended)
1. Go to https://www.ilovepdf.com/ocr-pdf
2. Upload your PDF
3. Select your language
4. Click "OCR PDF"
5. Download the processed PDF with text layer
6. Upload to Teacher Mode

**Pros:** Free, no software needed, good quality
**Cons:** File size limit (15MB free)

#### SmallPDF
1. Visit https://smallpdf.com/pdf-ocr
2. Similar process as above
3. Good for smaller files

### Option 2: Adobe Acrobat Pro (Best Quality)
1. Open your PDF in Adobe Acrobat Pro
2. Go to Tools → Scan & OCR
3. Click "Recognize Text" → "In This File"
4. Settings:
   - Language: Select your document's language
   - Output: Searchable Image or Editable Text
   - Downsample to: 300 dpi (for quality)
5. Click "Recognize Text"
6. Save the PDF
7. Upload to Teacher Mode

**Pros:** Best accuracy, handles complex layouts
**Cons:** Requires paid software

### Option 3: Command Line Tools (Free & Powerful)

#### OCRmyPDF (Recommended for batch processing)
```bash
# Install (Windows with WSL, Mac, Linux)
pip install ocrmypdf

# Basic usage
ocrmypdf input.pdf output.pdf

# With quality improvements
ocrmypdf --force-ocr --deskew --clean --rotate-pages input.pdf output.pdf

# For multiple files
for file in *.pdf; do
  ocrmypdf "$file" "ocr_$file"
done
```

**Pros:** Free, batch processing, excellent quality
**Cons:** Requires Python installation

## PDF Quality Tips

For best OCR results:
1. **Scan at 300 DPI or higher**
2. **Use black text on white background**
3. **Avoid skewed or rotated pages**
4. **Clear, readable fonts work best**
5. **Avoid handwritten text if possible**

## Pre-Processing Your PDFs

If OCR quality is poor, pre-process your PDFs:

### Option 1: Adobe Acrobat
- Tools → Scan & OCR → Recognize Text → In This File

### Option 2: Free Online Tools
- ILovePDF: https://www.ilovepdf.com/ocr-pdf
- SmallPDF: https://smallpdf.com/pdf-ocr

### Option 3: Command Line (OCRmyPDF)
```bash
# Install OCRmyPDF
pip install ocrmypdf

# Add OCR layer to PDF
ocrmypdf input.pdf output.pdf --force-ocr --deskew --clean
```

## Troubleshooting

### OCR Returns Empty or Gibberish Text
- Check if PDF is encrypted or password-protected
- Verify image quality (not too compressed)
- Try different OCR engines or services

### API Limits Reached
- OCR.space: 25,000/month free
- Consider upgrading or using rotation with multiple keys
- Pre-process PDFs locally before uploading

### Slow Processing
- Large PDFs take time to process
- Consider processing page by page
- Show progress indicator to users