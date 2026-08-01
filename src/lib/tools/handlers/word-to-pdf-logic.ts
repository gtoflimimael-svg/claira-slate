import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { convertWithLibreOffice, checkSofficeAvailable, type LibreOfficeFilterValue } from "@/lib/tools/libreoffice";
import { renderHtmlToPdf } from "@/lib/tools/handlers/simple-html-to-pdf";

export type WordToPdfQuality = "standard" | "high" | "compressed";

export interface WordToPdfConfig {
  quality: WordToPdfQuality;
  embedFonts: boolean;
  includeComments: boolean;
  password: string | null;
}

export interface WordToPdfResult {
  buffer: Buffer;
  pagesCreated: number;
}

const QUALITY_FILTER: Record<WordToPdfQuality, Record<string, LibreOfficeFilterValue>> = {
  standard: { Quality: { type: "long", value: "90" }, ReduceImageResolution: { type: "boolean", value: "false" } },
  high: { Quality: { type: "long", value: "97" }, ReduceImageResolution: { type: "boolean", value: "false" } },
  compressed: {
    Quality: { type: "long", value: "45" },
    ReduceImageResolution: { type: "boolean", value: "true" },
    MaxImageResolution: { type: "long", value: "150" },
  },
};

function extOf(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : "docx";
}

async function countPages(buffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getText({ pageJoiner: "" });
    return info.total;
  } finally {
    await parser.destroy();
  }
}

async function runWordToPdfWithLibreOffice(fileBuffer: Buffer, inputExt: string, config: WordToPdfConfig): Promise<WordToPdfResult> {
  const baseFilterData: Record<string, LibreOfficeFilterValue> = {
    ...QUALITY_FILTER[config.quality],
    EmbedStandardFonts: { type: "boolean", value: String(config.embedFonts) },
    ExportNotesInMargin: { type: "boolean", value: String(config.includeComments) },
  };

  const plainBuffer = await convertWithLibreOffice(fileBuffer, inputExt, "pdf", {
    filterName: "writer_pdf_Export",
    filterData: baseFilterData,
  });
  if (!plainBuffer) {
    throw new Error("PDF conversion isn't available on this server right now.");
  }
  const pagesCreated = await countPages(plainBuffer);

  if (!config.password) {
    return { buffer: plainBuffer, pagesCreated };
  }

  // Page-counted via the unencrypted pass above, since an encrypted PDF can't
  // be opened for counting without re-entering the password.
  const encryptedBuffer = await convertWithLibreOffice(fileBuffer, inputExt, "pdf", {
    filterName: "writer_pdf_Export",
    filterData: {
      ...baseFilterData,
      EncryptFile: { type: "boolean", value: "true" },
      DocumentOpenPassword: { type: "string", value: config.password },
    },
  });
  if (!encryptedBuffer) {
    throw new Error("PDF conversion isn't available on this server right now.");
  }
  return { buffer: encryptedBuffer, pagesCreated };
}

// Runs when LibreOffice isn't installed (e.g. Vercel's serverless runtime).
// mammoth only reads the modern .docx format — legacy .doc needs the real
// engine — and pdf-lib can't encrypt a PDF, so password protection isn't
// available here either. Both are reported as clear errors rather than
// silently producing an unprotected file or failing opaquely.
export async function runWordToPdfFallback(fileBuffer: Buffer, inputExt: string, config: WordToPdfConfig): Promise<WordToPdfResult> {
  if (inputExt !== "docx") {
    throw new Error("Legacy .doc files need the primary conversion engine, which isn't available on this server right now. Please try again later.");
  }
  if (config.password) {
    throw new Error("Password protection isn't available on this server right now. Try converting without a password, or try again later.");
  }

  const { value: html } = await mammoth.convertToHtml({ buffer: fileBuffer });
  const { buffer, pagesCreated } = await renderHtmlToPdf(html, { pageWidth: 595.28, pageHeight: 841.89, margin: 56 });
  return { buffer, pagesCreated };
}

export async function runWordToPdf(fileBuffer: Buffer, filename: string, config: WordToPdfConfig): Promise<WordToPdfResult> {
  const inputExt = extOf(filename);
  if (await checkSofficeAvailable()) {
    return runWordToPdfWithLibreOffice(fileBuffer, inputExt, config);
  }
  return runWordToPdfFallback(fileBuffer, inputExt, config);
}
