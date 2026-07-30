import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

export async function loadPdfDoc(buffer: Buffer): Promise<PDFDocument> {
  return PDFDocument.load(buffer, { ignoreEncryption: true, throwOnInvalidObject: false });
}

/** Runs `draw` on every page of the document, then returns the saved bytes. */
export async function stampEveryPage(
  buffer: Buffer,
  draw: (page: PDFPage, font: PDFFont, pageIndex: number, totalPages: number) => void
): Promise<Uint8Array> {
  const doc = await loadPdfDoc(buffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, i) => draw(page, font, i, pages.length));
  return doc.save();
}
