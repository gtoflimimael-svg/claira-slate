import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type Position = "TL" | "TC" | "TR" | "ML" | "MC" | "MR" | "BL" | "BC" | "BR";
export type FontFamily = "helvetica" | "times" | "courier" | "helvetica-oblique";

export interface TextStyle {
  fontSize: number;
  fontFamily: FontFamily;
  color: string; // "#rrggbb"
  bold: boolean;
  italic: boolean;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.07, 0.07, 0.07];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export async function fontFor(doc: PDFDocument, family: FontFamily, bold: boolean, italic: boolean): Promise<PDFFont> {
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
  const wantItalic = italic || family === "helvetica-oblique";
  if (bold && wantItalic) return doc.embedFont(StandardFonts.HelveticaBoldOblique);
  if (bold) return doc.embedFont(StandardFonts.HelveticaBold);
  if (wantItalic) return doc.embedFont(StandardFonts.HelveticaOblique);
  return doc.embedFont(StandardFonts.Helvetica);
}

/** Anchor point for a piece of text at a 9-grid position, given its own measured size. */
export function positionOrigin(position: Position, pageW: number, pageH: number, boxW: number, boxH: number, margin: number): { x: number; y: number } {
  const xFor = { L: margin, C: pageW / 2 - boxW / 2, R: pageW - margin - boxW };
  const yFor = { T: pageH - margin - boxH, M: pageH / 2 - boxH / 2, B: margin };
  const col = position[1] as "L" | "C" | "R";
  const row = position[0] as "T" | "M" | "B";
  return { x: xFor[col], y: yFor[row] };
}

export function drawStyledText(page: PDFPage, text: string, font: PDFFont, style: TextStyle, x: number, y: number): void {
  const [r, g, b] = hexToRgb01(style.color);
  page.drawText(text, { x, y, size: style.fontSize, font, color: rgb(r, g, b) });
}

const ROMAN_TABLE: [number, string][] = [
  [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"],
  [100, "c"], [90, "xc"], [50, "l"], [40, "xl"],
  [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
];

export function toRoman(num: number): string {
  let n = Math.max(1, Math.floor(num));
  let out = "";
  for (const [value, symbol] of ROMAN_TABLE) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}

/** 1 -> A, 26 -> Z, 27 -> AA, 28 -> AB, ... (spreadsheet-column style). */
export function toAlpha(num: number): string {
  let n = Math.max(1, Math.floor(num));
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function resolvePageSet(applyTo: "all" | "skip-first" | "odd" | "even" | number[], pageCount: number): Set<number> {
  if (applyTo === "all") return new Set(Array.from({ length: pageCount }, (_, i) => i + 1));
  if (applyTo === "skip-first") return new Set(Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p !== 1));
  if (applyTo === "odd") return new Set(Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 1));
  if (applyTo === "even") return new Set(Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p % 2 === 0));
  return new Set(applyTo.filter((p) => p >= 1 && p <= pageCount));
}
