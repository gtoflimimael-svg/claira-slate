import ExcelJS from "exceljs";
import { PDFParse } from "pdf-parse";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { convertWithLibreOffice, checkSofficeAvailable } from "@/lib/tools/libreoffice";

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
const PAPER_DIMENSIONS_PT: Record<ExcelToPdfPaperSize, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  a3: [841.89, 1190.55],
  legal: [612, 1008],
};

export function loadWorkbook(fileBuffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's own .d.ts shadows "Buffer" locally with `extends ArrayBuffer`,
  // which real Node Buffers don't structurally satisfy — a known upstream
  // typing issue, not a runtime one, hence sidestepping it via Parameters<>.
  return workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]).then(() => workbook);
}

export function selectSheets(workbook: ExcelJS.Workbook, allSheets: boolean): void {
  if (!allSheets && workbook.worksheets.length > 1) {
    const active = workbook.worksheets[0];
    for (const sheet of [...workbook.worksheets]) {
      if (sheet.id !== active.id) workbook.removeWorksheet(sheet.id);
    }
  }
}

async function runExcelToPdfWithLibreOffice(workbook: ExcelJS.Workbook, config: ExcelToPdfConfig): Promise<ExcelToPdfResult> {
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

function columnLetterToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parsePrintArea(range: string | undefined): { startCol: number; endCol: number; startRow: number; endRow: number } | null {
  if (!range) return null;
  const m = range.match(/^\$?([A-Za-z]+)\$?(\d+):\$?([A-Za-z]+)\$?(\d+)$/);
  if (!m) return null;
  return { startCol: columnLetterToNumber(m[1]), startRow: Number(m[2]), endCol: columnLetterToNumber(m[3]), endRow: Number(m[4]) };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Runs when LibreOffice isn't installed (e.g. Vercel's serverless runtime) —
// renders each sheet's cells directly as a pdf-lib table instead of relying
// on a real spreadsheet engine's print layout.
export async function runExcelToPdfFallback(workbook: ExcelJS.Workbook, config: ExcelToPdfConfig): Promise<ExcelToPdfResult> {
  let [pageWidth, pageHeight] = PAPER_DIMENSIONS_PT[config.paperSize];
  if (config.orientation === "landscape") [pageWidth, pageHeight] = [pageHeight, pageWidth];

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  const cellFontSize = 9;
  const cellPad = 4;
  const lineHeight = cellFontSize + 3;

  let page: PDFPage = doc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  }

  const sheetsConverted = workbook.worksheets.length;

  for (const sheet of workbook.worksheets) {
    if (cursorY < pageHeight - margin) newPage();

    if (config.includeSheetNames) {
      page.drawText(sheet.name, { x: margin, y: cursorY - 14, size: 13, font: boldFont, color: rgb(0.05, 0.05, 0.08) });
      cursorY -= 26;
    }

    const printArea = config.printAreaOnly ? parsePrintArea(sheet.pageSetup.printArea) : null;
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (printArea && (row.number < printArea.startRow || row.number > printArea.endRow)) return;
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const col = typeof cell.col === "number" ? cell.col : cells.length + 1;
        if (printArea && (col < printArea.startCol || col > printArea.endCol)) return;
        cells.push(String(cell.text ?? cell.value ?? ""));
      });
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length === 0) rows.push(["(empty sheet)"]);

    const cols = Math.max(...rows.map((r) => r.length), 1);
    const colWidth = contentWidth / cols;

    for (const row of rows) {
      const cellLines = row.map((cell) => wrapText(cell, font, cellFontSize, colWidth - cellPad * 2));
      const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
      const rowHeight = rowLines * lineHeight + cellPad * 2;

      if (cursorY - rowHeight < margin) newPage();
      const rowTop = cursorY;

      row.forEach((_, i) => {
        const x = margin + i * colWidth;
        cellLines[i].forEach((line, li) => {
          page.drawText(line, { x: x + cellPad, y: rowTop - cellPad - cellFontSize - li * lineHeight, size: cellFontSize, font, color: rgb(0.15, 0.15, 0.15) });
        });
      });
      if (config.includeGridlines) {
        page.drawRectangle({ x: margin, y: rowTop - rowHeight, width: contentWidth, height: rowHeight, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
        for (let i = 1; i < cols; i++) {
          const x = margin + i * colWidth;
          page.drawLine({ start: { x, y: rowTop }, end: { x, y: rowTop - rowHeight }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        }
      }
      cursorY -= rowHeight;
    }
    cursorY -= 18;
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, sheetsConverted, pagesCreated: doc.getPageCount() };
}

export async function runExcelToPdf(fileBuffer: Buffer, config: ExcelToPdfConfig): Promise<ExcelToPdfResult> {
  const workbook = await loadWorkbook(fileBuffer);
  selectSheets(workbook, config.allSheets);

  if (await checkSofficeAvailable()) {
    return runExcelToPdfWithLibreOffice(workbook, config);
  }
  return runExcelToPdfFallback(workbook, config);
}
