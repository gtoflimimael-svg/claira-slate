import { PDFDocument, rgb } from "pdf-lib";
import { fontFor, hexToRgb01, resolvePageSet, type TextStyle } from "@/lib/tools/handlers/pdf-text-style";

export interface HeaderFooterSection {
  left?: string;
  center?: string;
  right?: string;
  fontSize: number;
  fontFamily: TextStyle["fontFamily"];
  color: string;
  bold: boolean;
  italic: boolean;
  showLine: boolean;
  margin: number;
}

export type HeaderFooterApplyTo = "all" | "skip-first" | "odd" | "even" | number[];

export interface HeaderFooterConfig {
  header: HeaderFooterSection;
  footer: HeaderFooterSection;
  applyTo: HeaderFooterApplyTo;
  lineColor: string;
  lineThickness: number;
  documentTitle?: string;
  documentAuthor?: string;
}

export interface HeaderFooterResult {
  buffer: Buffer;
  pagesUpdated: number;
}

export function substituteVariables(template: string, ctx: { page: number; total: number; date: string; title: string; author: string }): string {
  return template
    .replace(/\{page\}/g, String(ctx.page))
    .replace(/\{total\}/g, String(ctx.total))
    .replace(/\{date\}/g, ctx.date)
    .replace(/\{title\}/g, ctx.title)
    .replace(/\{author\}/g, ctx.author);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function runHeaderFooter(fileBuffer: Buffer, config: HeaderFooterConfig): Promise<HeaderFooterResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  const targetPages = resolvePageSet(config.applyTo, pages.length);

  const headerFont = await fontFor(doc, config.header.fontFamily, config.header.bold, config.header.italic);
  const footerFont = await fontFor(doc, config.footer.fontFamily, config.footer.bold, config.footer.italic);

  const date = todayIso();
  const title = config.documentTitle ?? doc.getTitle() ?? "";
  const author = config.documentAuthor ?? doc.getAuthor() ?? "";
  const total = pages.length;

  let pagesUpdated = 0;
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    if (!targetPages.has(pageNum)) continue;
    pagesUpdated++;

    const page = pages[i];
    const { width, height } = page.getSize();
    const ctx = { page: pageNum, total, date, title, author };

    const drawSection = (section: HeaderFooterSection, font: typeof headerFont, isHeader: boolean) => {
      const [r, g, b] = hexToRgb01(section.color);
      const y = isHeader ? height - section.margin - section.fontSize : section.margin;

      if (section.left) {
        const text = substituteVariables(section.left, ctx);
        page.drawText(text, { x: section.margin, y, size: section.fontSize, font, color: rgb(r, g, b) });
      }
      if (section.center) {
        const text = substituteVariables(section.center, ctx);
        const w = font.widthOfTextAtSize(text, section.fontSize);
        page.drawText(text, { x: width / 2 - w / 2, y, size: section.fontSize, font, color: rgb(r, g, b) });
      }
      if (section.right) {
        const text = substituteVariables(section.right, ctx);
        const w = font.widthOfTextAtSize(text, section.fontSize);
        page.drawText(text, { x: width - section.margin - w, y, size: section.fontSize, font, color: rgb(r, g, b) });
      }
      if (section.showLine) {
        const [lr, lg, lb] = hexToRgb01(config.lineColor);
        const lineY = isHeader ? y - 6 : y + section.fontSize + 6;
        page.drawLine({
          start: { x: section.margin, y: lineY },
          end: { x: width - section.margin, y: lineY },
          thickness: config.lineThickness,
          color: rgb(lr, lg, lb),
        });
      }
    };

    drawSection(config.header, headerFont, true);
    drawSection(config.footer, footerFont, false);
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesUpdated };
}
