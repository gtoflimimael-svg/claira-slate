import { PDFParse } from "pdf-parse";

export interface ExtractedPdf {
  text: string;
  pages: number;
  /** True when no extractable text layer was found — the PDF is likely scanned. */
  isScanned: boolean;
}

export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedPdf> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    return { text, pages: result.total, isScanned: text.length === 0 };
  } finally {
    await parser.destroy();
  }
}
