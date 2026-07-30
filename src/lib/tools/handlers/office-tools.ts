import { convertWithLibreOffice } from "@/lib/tools/libreoffice";
import type { ToolInput, ToolResult } from "@/lib/tools/types";

function extOf(filename: string, fallback: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1].toLowerCase() : fallback;
}

async function convert(
  input: ToolInput,
  inputFallbackExt: string,
  outputExt: string,
  outputFilename: string,
  mimeType: string
): Promise<ToolResult> {
  const inputExt = extOf(input.filenames[0] ?? "", inputFallbackExt);
  const result = await convertWithLibreOffice(input.files[0], inputExt, outputExt);
  if (!result) {
    return { comingSoon: true, message: "This conversion needs LibreOffice, which isn't available on this server yet." };
  }
  return { buffer: result, filename: outputFilename, mimeType };
}

export const wordToPdf = (input: ToolInput) => convert(input, "docx", "pdf", "converted.pdf", "application/pdf");
export const excelToPdf = (input: ToolInput) => convert(input, "xlsx", "pdf", "converted.pdf", "application/pdf");
export const pptToPdf = (input: ToolInput) => convert(input, "pptx", "pdf", "converted.pdf", "application/pdf");
export const htmlToPdf = (input: ToolInput) => convert(input, "html", "pdf", "converted.pdf", "application/pdf");
