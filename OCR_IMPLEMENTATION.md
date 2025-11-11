# OCR Implementation for PDF Processing

## Overview
This implementation adds proper OCR (Optical Character Recognition) functionality to extract text from image-based PDF pages. The system now detects when PDF pages are actually scanned images and uses Tesseract.js to extract text from them.

## Key Features

### 1. Intelligent OCR Detection
- Automatically detects when a PDF has minimal text (likely scanned images)
- Identifies specific pages that contain images but little text
- Uses multiple criteria to determine if OCR is needed:
  - Average characters per page < 100
  - Empty or mostly whitespace content
  - Low word count per page

### 2. Direct PDF Processing
- Works directly with the uploaded PDF buffer (not Cloudinary URLs)
- Extracts pages as images using pdf2pic library
- Processes images with Tesseract.js for text extraction

### 3. OCR Processing Pipeline
```
PDF Upload → Detect Image Pages → Extract Page as PNG → OCR with Tesseract → 
Combine with Original Text → Create Embeddings → Store in Pinecone
```

### 4. Integration Points

#### Main Upload Processing (`src/app/api/uploadthing/core.ts`)
- Checks if OCR is needed using `shouldUseOCR()`
- Runs full OCR extraction if minimal text detected
- Processes extracted images with OCR for specific pages
- Updates embeddings with OCR metadata (confidence scores)

#### OCR Module (`src/lib/pdf-ocr.ts`)
- **`extractTextWithOCR()`**: Full document OCR extraction
- **`extractTextFromPagesWithOCR()`**: Specific page OCR extraction
- **`performOCR()`**: Core OCR processing with image preprocessing
- **`shouldUseOCR()`**: Intelligent detection of OCR needs

#### OCR Processor (`src/lib/pdf-ocr-processor.ts`)
- **`processImagesWithOCR()`**: Processes uploaded images with OCR
- **`enhancedTextExtraction()`**: Combines regular and OCR extraction
- Calculates OCR confidence scores
- Intelligently combines original and OCR text

#### Chapter-Aware Indexing (`src/lib/chapter-aware-pinecone.ts`)
- Updated to handle OCR content
- Adds OCR metadata to vector embeddings
- Tracks which content came from OCR vs regular extraction

## OCR Configuration

### Tesseract.js Settings
```javascript
{
  lang: 'eng', // English language
  tessedit_ocr_engine_mode: 1, // LSTM neural net
  tessedit_pageseg_mode: 3, // Fully automatic
  preserve_interword_spaces: 1 // Preserve spacing
}
```

### Image Preprocessing
- Converts to grayscale for better recognition
- Normalizes contrast
- Sharpens text edges
- 300 DPI resolution for optimal quality

### pdf2pic Configuration
```javascript
{
  density: 300, // High DPI for OCR
  format: 'png',
  width: 2480, // A4 at 300 DPI
  height: 3508
}
```

## Metadata Enhancement

All vectors stored in Pinecone now include OCR metadata:
- `hasOcrContent`: Boolean indicating OCR was used
- `ocrConfidence`: Confidence score (0-100)

This allows the system to:
- Filter or prioritize OCR content in search
- Provide transparency about content source
- Adjust relevance scoring based on OCR confidence

## Performance Considerations

1. **Batch Processing**: OCR processes pages in batches of 5 to avoid memory issues
2. **Worker Management**: Properly terminates Tesseract workers after use
3. **Fallback Strategy**: Falls back to regular extraction if OCR fails
4. **System Temp Directory**: Uses OS temp directory for intermediate files

## Usage Examples

### When OCR is Triggered
1. PDF with average < 100 characters per page
2. Pages detected with images but minimal text
3. Manual trigger when specific pages need OCR

### OCR Output Format
```
--- Page 1 ---
[Regular extracted text if any]

--- Page 2 (OCR) ---
[OCR extracted text]
```

## Error Handling
- Graceful fallback to regular extraction
- Detailed logging at each step
- Confidence scoring to identify poor OCR results
- Cleanup of resources on error

## Future Enhancements
- Support for additional languages
- Custom OCR models for specific document types
- Parallel processing for faster extraction
- Integration with cloud OCR services for comparison