import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";
import { convertWithLibreOffice } from "@/lib/tools/libreoffice";

export type ExcelToPdfOrientation = "portrait" | "landscape" | "auto";
export type ExcelToPdfPaperSize = "a4" | "letter" | "a3" | "legal";

export interface ExcelToPdfConfig {
  orientation: ExcelToPdfOrientation;
  fitToPage: boolean;
  includeGridlines: boolean;
  includeSheetNames: boolean;
  allSheets: boolean;
  printAreaOnly: boolean;
  paperSize: ExcelToPdfPaperSize;
}

export interface ExcelToPdfResult {
  buffer: Buffer;
  sheetsConverted: number;
  pagesCreated: number;
}

const PAPER_SIZE: Record<ExcelToPdfPaperSize, number> = { letter: 1, legal: 5, a3: 8, a4: 9 };

// LibreOffice's calc_pdf_Export filter has no direct "orientation"/"paper
// size" property — those are page-layout properties native to the XLSX
// itself, which LibreOffice's PDF export honors when converting. So the
// source workbook is rewritten with ExcelJS first, then handed to
// LibreOffice for the actual PDF rendering.
export async function runExcelToPdf(fileBuffer: Buffer, config: ExcelToPdfConfig): Promise<ExcelToPdfResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own .d.ts shadows "Buffer" locally with `extends ArrayBuffer`,
  // which real Node Buffers don't structurally satisfy — a known upstream
  // typing issue, not a runtime one, hence sidestepping it via Parameters<>.
  await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  if (!config.allSheets && workbook.worksheets.length > 1) {
    const active = workbook.worksheets[0];
    for (const sheet of [...workbook.worksheets]) {
      if (sheet.id !== active.id) workbook.removeWorksheet(sheet.id);
    }
  }

  const sheetsConverted = workbook.worksheets.length;

  for (const sheet of workbook.worksheets) {
    if (config.orientation !== "auto") sheet.pageSetup.orientation = config.orientation;
    sheet.pageSetup.paperSize = PAPER_SIZE[config.paperSize];
    sheet.pageSetup.showGridLines = config.includeGridlines;
    if (config.fitToPage) {
      sheet.pageSetup.fitToPage = true;
      sheet.pageSetup.fitToWidth = 1;
      sheet.pageSetup.fitToHeight = 0;
    }
    if (!config.printAreaOnly) sheet.pageSetup.printArea = "";
    if (config.includeSheetNames) {
      const oddHeader = `&C&"-,Bold"${sheet.name}`;
      sheet.headerFooter = { ...sheet.headerFooter, oddHeader, evenHeader: oddHeader };
    }
  }

  const preparedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const buffer = await convertWithLibreOffice(preparedBuffer, "xlsx", "pdf");
  if (!buffer) {
    throw new Error("PDF conversion isn't available on this server right now.");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getText({ pageJoiner: "" });
    return { buffer, sheetsConverted, pagesCreated: info.total };
  } finally {
    await parser.destroy();
  }
}
