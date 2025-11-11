# Quill - A Modern Fullstack SaaS-Platform

Built with the Next.js 13.5 App Router, tRPC, TypeScript, Prisma & Tailwind

![Project Image](https://github.com/joschan21/quill/blob/master/public/thumbnail.png)

## Features

- 🛠️ Complete SaaS Built From Scratch
- 💻 Beautiful Landing Page & Pricing Page Included
- 💳 Free & Pro Plan Using Stripe
- 📄 A Beautiful And Highly Functional PDF Viewer
- 🔄 Streaming API Responses in Real-Time
- 🔒 Authentication Using Kinde
- 🎨 Clean, Modern UI Using 'shadcn-ui'
- 🚀 Optimistic UI Updates for a Great UX
- ⚡ Infinite Message Loading for Performance
- 📤 Intuitive Drag n’ Drop Uploads
- ✨ Instant Loading States
- 🔧 Modern Data Fetching Using tRPC & Zod
- 🧠 LangChain for Infinite AI Memory
- 🌲 Pinecone as our Vector Storage
- 📊 Prisma as our ORM
- 🔤 100% written in TypeScript
- 🎁 ...much more

## Handling Image-Based PDFs

If your PDFs are scanned documents (image-based), they need OCR pre-processing:

1. **Check if your PDF needs OCR:**
   ```bash
   node check-pdf-ocr.js your-file.pdf
   ```

2. **Pre-process with OCR (choose one):**
   - **Online (Easy):** Use [ILovePDF OCR](https://www.ilovepdf.com/ocr-pdf) - free for files under 15MB
   - **Adobe Acrobat:** Tools → Scan & OCR → Recognize Text
   - **Command Line:** `ocrmypdf input.pdf output.pdf`

3. **Upload the processed PDF** to Teacher Mode

See `PDF_PREPROCESSING_GUIDE.md` for detailed instructions.

## Getting started

To get started with this project, run

```bash
  git clone https://github.com/joschan21/quill.git
```

and copy the .env.example variables into a separate .env file, fill them out & and that's all you need to get started!


## Acknowledgements

- [Kinde Auth](https://link.joshtriedcoding.com/kinde) for making this project possible

## License

[MIT](https://choosealicense.com/licenses/mit/)
