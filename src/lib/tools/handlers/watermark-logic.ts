import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { sniffImageType } from "@/lib/tools/image-format";

export type WatermarkPosition = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";
export type WatermarkFontFamily = "helvetica" | "times" | "courier" | "helvetica-oblique";

export interface WatermarkTextConfig {
  content: string;
  fontSize: number;
  fontFamily: WatermarkFontFamily;
  color: string; // "#rrggbb"
  opacity: number; // 0-1
  bold: boolean;
  italic: boolean;
}

export interface WatermarkConfig {
  type: "text" | "image";
  text?: WatermarkTextConfig;
  imageBuffer?: Buffer;
  imageOpacity?: number;
  position: WatermarkPosition;
  diagonal: boolean;
  applyTo: "all" | "first" | number[];
  scale?: number;
}

export interface WatermarkResult {
  buffer: Buffer;
  pagesStamped: number;
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.5, 0.5, 0.5];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function resolvePages(applyTo: WatermarkConfig["applyTo"], pageCount: number): number[] {
  if (applyTo === "all") return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (applyTo === "first") return pageCount > 0 ? [1] : [];
  return applyTo.filter((p) => p >= 1 && p <= pageCount);
}

function positionOrigin(position: WatermarkPosition, pageW: number, pageH: number, boxW: number, boxH: number, margin: number): { x: number; y: number } {
  const xFor = { L: margin, C: pageW / 2 - boxW / 2, R: pageW - margin - boxW };
  const yFor = { T: pageH - margin - boxH, M: pageH / 2 - boxH / 2, B: margin };
  const col = position[1] as "L" | "C" | "R";
  const row = position[0] as "T" | "M" | "B";
  return { x: xFor[col], y: yFor[row] };
}

async function fontFor(doc: PDFDocument, family: WatermarkFontFamily, bold: boolean, italic: boolean): Promise<PDFFont> {
  if (family === "times") {
    if (bold && italic) return doc.embedFont(StandardFonts.TimesRomanBoldItalic);
    if (bold) return doc.embedFont(StandardFonts.TimesRomanBold);
    if (italic) return doc.embedFont(StandardFonts.TimesRomanItalic);
    return doc.embedFont(StandardFonts.TimesRoman);
  }
  if (family === "courier") {
    if (bold && italic) return doc.embedFont(StandardFonts.CourierBoldOblique);
    if (bold) return doc.embedFont(StandardFonts.CourierBold);
    if (italic) return doc.embedFont(StandardFonts.CourierOblique);
    return doc.embedFont(StandardFonts.Courier);
  }
  // helvetica / helvetica-oblique both map onto the Helvetica family — the
  // "oblique" option just defaults the italic look without requiring the
  // checkbox, still combinable with bold.
  const wantItalic = italic || family === "helvetica-oblique";
  if (bold && wantItalic) return doc.embedFont(StandardFonts.HelveticaBoldOblique);
  if (bold) return doc.embedFont(StandardFonts.HelveticaBold);
  if (wantItalic) return doc.embedFont(StandardFonts.HelveticaOblique);
  return doc.embedFont(StandardFonts.Helvetica);
}

function drawTextWatermark(page: PDFPage, font: PDFFont, text: WatermarkTextConfig, position: WatermarkPosition, diagonal: boolean) {
  const { width: pageW, height: pageH } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text.content, text.fontSize);
  const textHeight = text.fontSize;
  const margin = Math.max(20, pageW * 0.04);
  const [r, g, b] = hexToRgb01(text.color);

  if (diagonal) {
    // Diagonal watermarks are conventionally centered regardless of the
    // 9-position grid, matching how most PDF tools render them.
    page.drawText(text.content, {
      x: pageW / 2 - textWidth / 2,
      y: pageH / 2 - textHeight / 2,
      size: text.fontSize,
      font,
      color: rgb(r, g, b),
      opacity: text.opacity,
      rotate: degrees(45),
    });
    return;
  }

  const { x, y } = positionOrigin(position, pageW, pageH, textWidth, textHeight, margin);
  page.drawText(text.content, { x, y, size: text.fontSize, font, color: rgb(r, g, b), opacity: text.opacity });
}

export async function runWatermark(fileBuffer: Buffer, config: WatermarkConfig): Promise<WatermarkResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  const targetPages = resolvePages(config.applyTo, pages.length);

  if (config.type === "text") {
    if (!config.text) throw new Error("Watermark text is required.");
    const font = await fontFor(doc, config.text.fontFamily, config.text.bold, config.text.italic);
    for (const pageNum of targetPages) {
      drawTextWatermark(pages[pageNum - 1], font, config.text, config.position, config.diagonal);
    }
  } else {
    if (!config.imageBuffer) throw new Error("A watermark image is required.");
    const type = sniffImageType(config.imageBuffer);
    if (!type || (type !== "png" && type !== "jpg")) throw new Error("Watermark image must be a PNG or JPEG.");
    const embedded = type === "png" ? await doc.embedPng(config.imageBuffer) : await doc.embedJpg(config.imageBuffer);
    const scale = config.scale ?? 1;
    const opacity = config.imageOpacity ?? 0.5;

    for (const pageNum of targetPages) {
      const page = pages[pageNum - 1];
      const { width: pageW, height: pageH } = page.getSize();
      const maxW = pageW * 0.35 * scale;
      const imgScale = Math.min(maxW / embedded.width, (pageH * 0.35 * scale) / embedded.height);
      const w = embedded.width * imgScale;
      const h = embedded.height * imgScale;
      const margin = Math.max(20, pageW * 0.04);

      if (config.diagonal) {
        page.drawImage(embedded, {
          x: pageW / 2 - w / 2,
          y: pageH / 2 - h / 2,
          width: w,
          height: h,
          opacity,
          rotate: degrees(45),
        });
      } else {
        const { x, y } = positionOrigin(config.position, pageW, pageH, w, h, margin);
        page.drawImage(embedded, { x, y, width: w, height: h, opacity });
      }
    }
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesStamped: targetPages.length };
}
