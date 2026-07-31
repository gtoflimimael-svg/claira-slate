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

type Handler = (input: ToolInput) => Promise<ToolResult>;

// Loaded lazily and per-tool, not as one static import at the top of this
// file: raster-tools.ts pulls in pdf-parse (which needs @napi-rs/canvas), and
// office-tools.ts pulls in the LibreOffice bridge. A static top-level import
// pulls all three handler modules — and their native/heavy dependencies —
// into every request regardless of which tool was actually called, so a
// plain pdf-lib operation like "merge" would crash if pdf-parse's optional
// native canvas dependency failed to load in the serverless runtime.
const HANDLER_LOADERS: Record<string, () => Promise<Handler>> = {
  merge: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).merge,
  split: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).split,
  reorder: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).reorder,
  rotate: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).rotate,
  "extract-pages": async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).extractPages,
  "delete-pages": async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).deletePages,
  flatten: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).flatten,
  repair: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).repair,
  watermark: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).watermark,
  "number-pages": async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).numberPages,
  "header-footer": async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).headerFooter,
  "jpg-to-pdf": async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).jpgToPdf,
  crop: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).crop,
  sign: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).sign,
  annotate: async () => (await import("@/lib/tools/handlers/pdf-lib-tools")).annotate,

  compress: async () => (await import("@/lib/tools/handlers/raster-tools")).compress,
  optimize: async () => (await import("@/lib/tools/handlers/raster-tools")).optimize,
  grayscale: async () => (await import("@/lib/tools/handlers/raster-tools")).grayscale,
  "pdf-to-jpg": async () => (await import("@/lib/tools/handlers/raster-tools")).pdfToJpg,
  redact: async () => (await import("@/lib/tools/handlers/raster-tools")).redact,

  "word-to-pdf": async () => (await import("@/lib/tools/handlers/office-tools")).wordToPdf,
  "excel-to-pdf": async () => (await import("@/lib/tools/handlers/office-tools")).excelToPdf,
  "ppt-to-pdf": async () => (await import("@/lib/tools/handlers/office-tools")).pptToPdf,
  "html-to-pdf": async () => (await import("@/lib/tools/handlers/office-tools")).htmlToPdf,
};

export async function runTool(slug: string, input: ToolInput): Promise<ToolResult> {
  if (slug in STUB_MESSAGE) {
    return { comingSoon: true, message: STUB_MESSAGE[slug] };
  }
  const loadHandler = HANDLER_LOADERS[slug];
  if (!loadHandler) {
    throw new Error(`No handler registered for tool "${slug}"`);
  }
  const handler = await loadHandler();
  return handler(input);
}
