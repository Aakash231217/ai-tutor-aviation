declare module 'pdf-parse' {
  interface PDFData {
    numpages: number
    numrender: number
    info: any
    metadata: any
    text: string
    version: string
  }

  function pdfParse(
    dataBuffer: Buffer,
    options?: {
      pagerender?: (pageData: any) => string
      max?: number
      version?: string
      normalizeWhitespace?: boolean
      disableCombineTextItems?: boolean
    }
  ): Promise<PDFData>

  export default pdfParse
}