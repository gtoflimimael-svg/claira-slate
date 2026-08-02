import { PDFDocument } from "pdf-lib";
import { fontFor, positionOrigin, drawStyledText, toRoman, toAlpha, resolvePageSet, type Position, type TextStyle } from "@/lib/tools/handlers/pdf-text-style";

export type NumberFormat = "numeric" | "with-total" | "roman" | "alpha" | "custom";

export interface NumberPagesConfig {
  position: Position;
  format: NumberFormat;
  customPrefix?: string;
  startFrom: number;
  applyTo: "all" | "skip-first" | number[];
  style: TextStyle;
  margin: number;
}

export interface NumberPagesResult {
  buffer: Buffer;
  pagesNumbered: number;
}

export function formatPageNumber(format: NumberFormat, n: number, total: number, customPrefix?: string): string {
  switch (format) {
    case "with-total":
      return `Page ${n} of ${total}`;
    case "roman":
      return toRoman(n);
    case "alpha":
      return toAlpha(n);
    case "custom":
      return `${customPrefix ?? ""}${n}`;
    case "numeric":
    default:
      return String(n);
  }
}

export async function runNumberPages(fileBuffer: Buffer, config: NumberPagesConfig): Promise<NumberPagesResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  const font = await fontFor(doc, config.style.fontFamily, config.style.bold, config.style.italic);
  const targetPages = resolvePageSet(config.applyTo, pages.length);

  // The visible label always starts at 1 in "Page X of Y" / roman / alpha
  // sequence — `startFrom` shifts the *count*, not the total, matching how
  // "start numbering from page N" works in desktop PDF editors.
  const lastTargetIndex = Math.max(...Array.from(targetPages), 0);
  const totalLabel = lastTargetIndex - 1 + config.startFrom;

  let pagesNumbered = 0;
  let counter = config.startFrom;
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    if (!targetPages.has(pageNum)) continue;
    const label = formatPageNumber(config.format, counter, totalLabel, config.customPrefix);
    counter++;
    pagesNumbered++;

    const page = pages[i];
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(label, config.style.fontSize);
    const { x, y } = positionOrigin(config.position, width, height, textWidth, config.style.fontSize, config.margin);
    drawStyledText(page, label, font, config.style, x, y);
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesNumbered };
}
