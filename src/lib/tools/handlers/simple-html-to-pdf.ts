import { parse, type HTMLElement, NodeType } from "node-html-parser";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";

export interface SimpleHtmlToPdfOptions {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  /** Strip <header>/<footer>/<nav> content instead of rendering it. Default false. */
  skipHeaderFooter?: boolean;
}

export interface SimpleHtmlToPdfResult {
  buffer: Buffer;
  pagesCreated: number;
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string; bold: boolean }
  | { type: "listitem"; text: string }
  | { type: "table"; rows: string[][] }
  | { type: "image"; data: Buffer }
  | { type: "space" };

const ALWAYS_SKIP_TAGS = new Set(["script", "style", "head", "noscript"]);
const HEADER_FOOTER_TAGS = new Set(["header", "footer", "nav"]);
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
// Tags whose text contributes to a *containing* paragraph rather than
// starting a new block of their own.
const INLINE_TAGS = new Set(["span", "strong", "b", "em", "i", "u", "a", "small", "code", "mark", "sub", "sup"]);

function isDataUriImage(src: string | undefined): Buffer | null {
  if (!src) return null;
  const match = src.match(/^data:image\/(png|jpe?g|gif|bmp|webp);base64,(.+)$/i);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

// An element is "leaf-like" (a paragraph candidate) only if every element
// child is a pure inline tag — anything else (div, section, p, table, h1..)
// means this element is a structural wrapper that must be recursed into
// instead of collapsed into one paragraph.
function isLeafContainer(el: HTMLElement): boolean {
  return el.childNodes.every((n) => n.nodeType !== NodeType.ELEMENT_NODE || INLINE_TAGS.has((n as HTMLElement).tagName?.toLowerCase() ?? ""));
}

function isBoldOnly(el: HTMLElement): boolean {
  const text = el.text.trim();
  if (!text) return false;
  const strongText = el.querySelectorAll("strong, b").map((n) => n.text).join("");
  return strongText.replace(/\s+/g, " ").trim() === text.replace(/\s+/g, " ").trim();
}

function extractTableRows(el: HTMLElement): string[][] {
  return el.querySelectorAll("tr").map((row) => row.querySelectorAll("td, th").map((cell) => cell.text.trim().replace(/\s+/g, " ")));
}

function walk(node: HTMLElement, blocks: Block[], skipHeaderFooter: boolean): void {
  for (const child of node.childNodes) {
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    const tag = el.tagName?.toLowerCase() ?? "";
    if (ALWAYS_SKIP_TAGS.has(tag)) continue;
    if (skipHeaderFooter && HEADER_FOOTER_TAGS.has(tag)) continue;

    if (HEADING_TAGS.has(tag)) {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "heading", level: Number(tag[1]), text });
      continue;
    }
    if (tag === "p") {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "paragraph", text, bold: isBoldOnly(el) });
      const img = el.querySelector("img");
      const imgData = img ? isDataUriImage(img.getAttribute("src")) : null;
      if (imgData) blocks.push({ type: "image", data: imgData });
      continue;
    }
    if (tag === "li") {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "listitem", text });
      continue;
    }
    if (tag === "ul" || tag === "ol") {
      walk(el, blocks, skipHeaderFooter);
      continue;
    }
    if (tag === "table") {
      const rows = extractTableRows(el).filter((r) => r.length > 0);
      if (rows.length > 0) blocks.push({ type: "table", rows });
      continue;
    }
    if (tag === "img") {
      const imgData = isDataUriImage(el.getAttribute("src"));
      if (imgData) blocks.push({ type: "image", data: imgData });
      continue;
    }
    if (tag === "br" || tag === "hr") {
      blocks.push({ type: "space" });
      continue;
    }

    // Generic container (div, span, section, article, body, a, strong, em, ...).
    // A leaf-like one (only inline/text children — common in div-soup markup)
    // becomes an implicit paragraph; anything with structural children (html,
    // body, div-of-divs, etc.) must be recursed into instead.
    if (isLeafContainer(el)) {
      const text = el.text.trim().replace(/\s+/g, " ");
      if (text) blocks.push({ type: "paragraph", text, bold: isBoldOnly(el) });
      continue;
    }
    walk(el, blocks, skipHeaderFooter);
  }
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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

export async function renderHtmlToPdf(html: string, opts: SimpleHtmlToPdfOptions): Promise<SimpleHtmlToPdfResult> {
  const root = parse(html, { blockTextElements: { script: false, style: false } });
  const blocks: Block[] = [];
  walk(root, blocks, opts.skipHeaderFooter ?? false);

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const { pageWidth, pageHeight, margin } = opts;
  const contentWidth = pageWidth - margin * 2;
  const lineGap = 4;

  let page: PDFPage = doc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  function newPage() {
    page = doc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  }

  function ensureSpace(height: number) {
    if (cursorY - height < margin) newPage();
  }

  function drawLines(lines: string[], size: number, f: PDFFont, color = rgb(0.12, 0.12, 0.12)) {
    for (const line of lines) {
      ensureSpace(size + lineGap);
      page.drawText(line, { x: margin, y: cursorY - size, size, font: f, color });
      cursorY -= size + lineGap;
    }
  }

  for (const block of blocks) {
    if (block.type === "heading") {
      const size = Math.max(13, 24 - (block.level - 1) * 2.5);
      ensureSpace(size + 10);
      cursorY -= 6;
      drawLines(wrapText(block.text, boldFont, size, contentWidth), size, boldFont, rgb(0.05, 0.05, 0.08));
      cursorY -= 4;
    } else if (block.type === "paragraph") {
      const f = block.bold ? boldFont : font;
      drawLines(wrapText(block.text, f, 11, contentWidth), 11, f);
      cursorY -= 6;
    } else if (block.type === "listitem") {
      const lines = wrapText(block.text, font, 11, contentWidth - 14);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(11 + lineGap);
        page.drawText(i === 0 ? "•" : "", { x: margin, y: cursorY - 11, size: 11, font, color: rgb(0.12, 0.12, 0.12) });
        page.drawText(lines[i], { x: margin + 14, y: cursorY - 11, size: 11, font, color: rgb(0.12, 0.12, 0.12) });
        cursorY -= 11 + lineGap;
      }
    } else if (block.type === "table") {
      const cols = Math.max(...block.rows.map((r) => r.length), 1);
      const colWidth = contentWidth / cols;
      for (const row of block.rows) {
        const cellLines = row.map((cell) => wrapText(cell, font, 9.5, colWidth - 8));
        const rowLines = Math.max(1, ...cellLines.map((l) => l.length));
        const rowHeight = rowLines * (9.5 + 3) + 6;
        ensureSpace(rowHeight);
        const rowTop = cursorY;
        row.forEach((_, i) => {
          const x = margin + i * colWidth;
          cellLines[i].forEach((line, li) => {
            page.drawText(line, { x: x + 4, y: rowTop - 12 - li * (9.5 + 3), size: 9.5, font, color: rgb(0.15, 0.15, 0.15) });
          });
        });
        page.drawRectangle({ x: margin, y: rowTop - rowHeight, width: contentWidth, height: rowHeight, borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 0.6 });
        cursorY -= rowHeight;
      }
      cursorY -= 6;
    } else if (block.type === "image") {
      try {
        const jpeg = await sharp(block.data).jpeg({ quality: 88 }).toBuffer();
        const meta = await sharp(jpeg).metadata();
        const w = meta.width ?? 300;
        const h = meta.height ?? 200;
        const scale = Math.min(1, contentWidth / w);
        const drawW = w * scale;
        const drawH = h * scale;
        ensureSpace(drawH + 10);
        const embedded = await doc.embedJpg(jpeg);
        page.drawImage(embedded, { x: margin, y: cursorY - drawH, width: drawW, height: drawH });
        cursorY -= drawH + 10;
      } catch {
        // Unsupported/corrupt embedded image — skip rather than fail the whole conversion.
      }
    } else if (block.type === "space") {
      cursorY -= 8;
    }
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesCreated: doc.getPageCount() };
}
