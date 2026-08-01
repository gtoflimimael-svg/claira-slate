import { PDFParse } from "pdf-parse";
import ExcelJS from "exceljs";
import { sniffImageType } from "@/lib/tools/image-format";

export type ExcelMode = "auto" | "all-rows";

export interface ExcelConfig {
  mode: ExcelMode;
  oneSheetPerPage: boolean;
  preserveBorders: boolean;
  autoFormat: boolean;
  includeImages: boolean;
}

export interface ExcelResult {
  buffer: Buffer;
  tablesFound: number;
  pagesScanned: number;
  rowsExtracted: number;
  imagesEmbedded: number;
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  bottom: { style: "thin" },
  left: { style: "thin" },
  right: { style: "thin" },
};

const NUMBER_RE = /^-?[\d,]+(\.\d+)?%?$/;
const DATE_RE = /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/;

function formatCellValue(raw: string): { value: string | number | Date; numFmt?: string } {
  const text = raw.trim();
  if (NUMBER_RE.test(text)) {
    const isPercent = text.endsWith("%");
    const num = parseFloat(text.replace(/,/g, "").replace(/%$/, "")) / (isPercent ? 100 : 1);
    if (!Number.isNaN(num)) return { value: num, numFmt: isPercent ? "0.00%" : undefined };
  }
  if (DATE_RE.test(text)) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) return { value: parsed, numFmt: "yyyy-mm-dd" };
  }
  return { value: raw };
}

function writeRow(sheet: ExcelJS.Worksheet, cells: string[], config: ExcelConfig, applyBorder: boolean) {
  const row = sheet.addRow(cells.map((c) => (config.autoFormat ? formatCellValue(c).value : c)));
  if (config.autoFormat) {
    cells.forEach((c, i) => {
      const { numFmt } = formatCellValue(c);
      if (numFmt) row.getCell(i + 1).numFmt = numFmt;
    });
  }
  if (applyBorder && config.preserveBorders) {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = THIN_BORDER;
    });
  }
}

function sheetNameForPage(page: number): string {
  return `Page ${page}`.slice(0, 31);
}

const EXCEL_IMAGE_EXTENSION: Partial<Record<"png" | "jpg" | "gif" | "bmp", "png" | "jpeg" | "gif">> = {
  png: "png",
  jpg: "jpeg",
  gif: "gif",
};

// ExcelJS anchors images by pixel position, not by "consuming" rows the way a
// table row does — a handful of blank rows are appended after each embedded
// image so later content on a combined sheet doesn't render underneath it.
function embedPageImages(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  images: { data: Uint8Array; width: number; height: number }[]
): number {
  let embedded = 0;
  for (const img of images) {
    const type = sniffImageType(img.data);
    const extension = type ? EXCEL_IMAGE_EXTENSION[type] : undefined;
    if (!extension) continue;
    const imageId = workbook.addImage({ base64: Buffer.from(img.data).toString("base64"), extension });
    const maxWidth = 400;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    sheet.addImage(imageId, { tl: { col: 0, row: sheet.rowCount }, ext: { width, height } });
    sheet.addRow([]);
    const rowsToReserve = Math.max(1, Math.ceil(height / 20));
    for (let i = 0; i < rowsToReserve; i++) sheet.addRow([]);
    embedded++;
  }
  return embedded;
}

export async function runPdfToExcel(fileBuffer: Buffer, config: ExcelConfig): Promise<ExcelResult> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const workbook = new ExcelJS.Workbook();
    let tablesFound = 0;
    let rowsExtracted = 0;
    let pagesScanned = 0;
    let imagesEmbedded = 0;

    const imagesByPage = new Map<number, Awaited<ReturnType<PDFParse["getImage"]>>["pages"][number]["images"]>();
    if (config.includeImages) {
      const imageResult = await parser.getImage({ imageBuffer: true, imageDataUrl: false });
      for (const p of imageResult.pages) imagesByPage.set(p.pageNumber, p.images);
    }

    if (config.mode === "auto") {
      const tableResult = await parser.getTable();
      pagesScanned = tableResult.total;

      let combinedSheet: ExcelJS.Worksheet | null = null;
      for (const page of tableResult.pages) {
        const images = imagesByPage.get(page.num);
        if (page.tables.length === 0 && !images?.length) continue;
        const sheet = config.oneSheetPerPage
          ? workbook.addWorksheet(sheetNameForPage(page.num))
          : (combinedSheet ??= workbook.addWorksheet("Tables"));

        for (const table of page.tables) {
          tablesFound++;
          for (const row of table) {
            writeRow(sheet, row, config, true);
            rowsExtracted++;
          }
          if (!config.oneSheetPerPage) sheet.addRow([]); // blank separator between tables on a shared sheet
        }

        if (images?.length) imagesEmbedded += embedPageImages(workbook, sheet, images);
      }

      if (workbook.worksheets.length === 0) {
        workbook.addWorksheet("Sheet1").addRow(["No tables were detected in this PDF."]);
      }
    } else {
      const textResult = await parser.getText({ cellSeparator: "\t" });
      pagesScanned = textResult.total;

      let combinedSheet: ExcelJS.Worksheet | null = null;
      for (const page of textResult.pages) {
        const lines = page.text.split("\n").filter((l) => l.trim().length > 0);
        const images = imagesByPage.get(page.num);
        if (lines.length === 0 && !images?.length) continue;
        const sheet = config.oneSheetPerPage ? workbook.addWorksheet(sheetNameForPage(page.num)) : (combinedSheet ??= workbook.addWorksheet("All content"));
        for (const line of lines) {
          writeRow(sheet, line.split("\t"), config, false);
          rowsExtracted++;
        }

        if (images?.length) imagesEmbedded += embedPageImages(workbook, sheet, images);
      }

      if (workbook.worksheets.length === 0) {
        workbook.addWorksheet("Sheet1").addRow(["No extractable text was found in this PDF."]);
      }
    }

    for (const sheet of workbook.worksheets) {
      sheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
          const len = String(cell.value ?? "").length;
          if (len > maxLength) maxLength = len;
        });
        column.width = Math.min(60, maxLength + 2);
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return { buffer, tablesFound, pagesScanned, rowsExtracted, imagesEmbedded };
  } finally {
    await parser.destroy();
  }
}
