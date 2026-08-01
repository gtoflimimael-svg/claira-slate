import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type ImagesToPdfPageSize = "fit" | "a4-portrait" | "a4-landscape" | "letter" | "match";
export type ImagesToPdfMargin = "none" | "small" | "medium" | "large";

export interface ImagesToPdfConfig {
  pageSize: ImagesToPdfPageSize;
  margin: ImagesToPdfMargin;
  imagesPerPage: 1 | 4;
  addPageNumbers: boolean;
  addCaptions: boolean;
}

export interface ImagesToPdfResult {
  buffer: Buffer;
  pagesCreated: number;
}

const MARGIN_PT: Record<ImagesToPdfMargin, number> = { none: 0, small: 18, medium: 36, large: 72 };
const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const LETTER_PORTRAIT: [number, number] = [612, 792];

interface DecodedImage {
  jpeg: Buffer;
  width: number;
  height: number;
  filename: string;
}

async function decodeImage(file: Buffer, filename: string): Promise<DecodedImage> {
  const jpeg = await sharp(file, { animated: false }).rotate().jpeg({ quality: 92 }).toBuffer();
  const meta = await sharp(jpeg).metadata();
  return { jpeg, width: meta.width ?? 612, height: meta.height ?? 792, filename };
}

function fixedPageSizeFor(pageSize: ImagesToPdfPageSize, firstImage: DecodedImage): [number, number] {
  switch (pageSize) {
    case "a4-portrait":
      return A4_PORTRAIT;
    case "a4-landscape":
      return A4_LANDSCAPE;
    case "letter":
      return LETTER_PORTRAIT;
    case "match":
      return [firstImage.width, firstImage.height];
    case "fit":
      return firstImage.height >= firstImage.width ? A4_PORTRAIT : A4_LANDSCAPE;
  }
}

function sanitizeCaption(name: string): string {
  return name.replace(/[\x00-\x1f]/g, "").slice(0, 90);
}

export async function runImagesToPdf(files: Buffer[], filenames: string[], config: ImagesToPdfConfig): Promise<ImagesToPdfResult> {
  const images = await Promise.all(files.map((f, i) => decodeImage(f, filenames[i] ?? `image-${i + 1}`)));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const margin = MARGIN_PT[config.margin];
  const captionHeight = config.addCaptions ? 16 : 0;

  const perPage = config.imagesPerPage;
  const usesFixedGrid = perPage > 1;

  // Per-image page sizing (used for 1-per-page, non-"match" modes) picks
  // portrait/landscape per image in "fit" mode; a shared grid page can't do
  // that, so it falls back to a single reference size for every page.
  const referenceSize = usesFixedGrid || config.pageSize === "match" ? fixedPageSizeFor(config.pageSize, images[0]) : null;

  function drawPageNumber(page: import("pdf-lib").PDFPage, num: number, pageW: number) {
    if (!config.addPageNumbers) return;
    const text = String(num);
    const size = 9;
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: pageW / 2 - width / 2, y: 12, size, font, color: rgb(0.45, 0.45, 0.45) });
  }

  function drawImageInBox(page: import("pdf-lib").PDFPage, img: DecodedImage, embedded: import("pdf-lib").PDFImage, box: { x: number; y: number; w: number; h: number }) {
    const availH = box.h - captionHeight;
    const scale = Math.min(box.w / img.width, availH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = box.x + (box.w - w) / 2;
    const y = box.y + captionHeight + (availH - h) / 2;
    page.drawImage(embedded, { x, y, width: w, height: h });
    if (config.addCaptions) {
      const caption = sanitizeCaption(img.filename);
      const size = 8;
      const textWidth = font.widthOfTextAtSize(caption, size);
      page.drawText(caption, { x: box.x + (box.w - Math.min(textWidth, box.w)) / 2, y: box.y + 3, size, font, color: rgb(0.4, 0.4, 0.4) });
    }
  }

  if (perPage === 1) {
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const [pageW, pageH] = referenceSize ?? fixedPageSizeFor(config.pageSize, img);
      const page = doc.addPage([pageW, pageH]);
      const embedded = await doc.embedJpg(img.jpeg);
      drawImageInBox(page, img, embedded, { x: margin, y: margin, w: pageW - margin * 2, h: pageH - margin * 2 });
      drawPageNumber(page, i + 1, pageW);
    }
  } else {
    const [pageW, pageH] = referenceSize!;
    const cols = 2;
    const rows = 2;
    const gap = Math.max(8, margin / 2);
    const gridW = pageW - margin * 2;
    const gridH = pageH - margin * 2;
    const cellW = (gridW - gap * (cols - 1)) / cols;
    const cellH = (gridH - gap * (rows - 1)) / rows;

    for (let i = 0; i < images.length; i += 4) {
      const page = doc.addPage([pageW, pageH]);
      for (let j = 0; j < 4 && i + j < images.length; j++) {
        const img = images[i + j];
        const embedded = await doc.embedJpg(img.jpeg);
        const col = j % cols;
        const row = Math.floor(j / cols);
        const cellX = margin + col * (cellW + gap);
        const cellY = pageH - margin - (row + 1) * cellH - row * gap;
        drawImageInBox(page, img, embedded, { x: cellX, y: cellY, w: cellW, h: cellH });
      }
      drawPageNumber(page, Math.floor(i / 4) + 1, pageW);
    }
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesCreated: doc.getPageCount() };
}
