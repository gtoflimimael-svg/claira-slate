import * as pdfLibTools from "@/lib/tools/handlers/pdf-lib-tools";
import * as rasterTools from "@/lib/tools/handlers/raster-tools";
import * as officeTools from "@/lib/tools/handlers/office-tools";
import type { ToolInput, ToolResult } from "@/lib/tools/types";

const STUB_MESSAGE: Record<string, string> = {
  protect: "Password protection is coming soon.",
  unlock: "Removing a password is coming soon.",
  certify: "PDF certification is coming soon.",
  "edit-text": "In-place text editing is coming soon.",
  // LibreOffice opens a PDF as a Draw document by default (no bundled Writer/
  // Calc/Impress PDF-import filter), so PDF -> editable-Office export fails.
  // The reverse direction (Office -> PDF, via *_pdf_Export filters) works fine.
  "pdf-to-word": "Converting a PDF to an editable Word document is coming soon.",
  "pdf-to-excel": "Converting a PDF to an editable spreadsheet is coming soon.",
  "pdf-to-ppt": "Converting a PDF to editable slides is coming soon.",
};

const HANDLERS: Record<string, (input: ToolInput) => Promise<ToolResult>> = {
  merge: pdfLibTools.merge,
  split: pdfLibTools.split,
  reorder: pdfLibTools.reorder,
  rotate: pdfLibTools.rotate,
  "extract-pages": pdfLibTools.extractPages,
  "delete-pages": pdfLibTools.deletePages,
  flatten: pdfLibTools.flatten,
  repair: pdfLibTools.repair,
  watermark: pdfLibTools.watermark,
  "number-pages": pdfLibTools.numberPages,
  "header-footer": pdfLibTools.headerFooter,
  "jpg-to-pdf": pdfLibTools.jpgToPdf,
  crop: pdfLibTools.crop,
  sign: pdfLibTools.sign,
  annotate: pdfLibTools.annotate,

  compress: rasterTools.compress,
  optimize: rasterTools.optimize,
  grayscale: rasterTools.grayscale,
  "pdf-to-jpg": rasterTools.pdfToJpg,
  redact: rasterTools.redact,

  "word-to-pdf": officeTools.wordToPdf,
  "excel-to-pdf": officeTools.excelToPdf,
  "ppt-to-pdf": officeTools.pptToPdf,
  "html-to-pdf": officeTools.htmlToPdf,
};

export async function runTool(slug: string, input: ToolInput): Promise<ToolResult> {
  if (slug in STUB_MESSAGE) {
    return { comingSoon: true, message: STUB_MESSAGE[slug] };
  }
  const handler = HANDLERS[slug];
  if (!handler) {
    throw new Error(`No handler registered for tool "${slug}"`);
  }
  return handler(input);
}
