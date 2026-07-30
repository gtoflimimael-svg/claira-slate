import { PDFParse } from "pdf-parse";
import { createWorker } from "tesseract.js";
import { PDFDocument, rgb } from "pdf-lib";

export interface OcrLine {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface OcrPage {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  image: Uint8Array;
  lines: OcrLine[];
  text: string;
}

const RENDER_SCALE = 2;

export async function runOcrOnPdf(buffer: Buffer): Promise<{ pages: OcrPage[]; fullText: string }> {
  const parser = new PDFParse({ data: buffer });
  let screenshots;
  try {
    screenshots = await parser.getScreenshot({ scale: RENDER_SCALE, imageBuffer: true, imageDataUrl: false });
  } finally {
    await parser.destroy();
  }

  const worker = await createWorker(["eng"]);
  const pages: OcrPage[] = [];

  try {
    for (const shot of screenshots.pages) {
      const result = await worker.recognize(Buffer.from(shot.data), {}, { text: true, blocks: true });

      const lines: OcrLine[] = [];
      for (const block of result.data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            if (!line.text.trim()) continue;
            const heightPx = line.bbox.y1 - line.bbox.y0;
            lines.push({
              text: line.text.trim(),
              x: line.bbox.x0 / RENDER_SCALE,
              // Image coordinates are top-down; PDF coordinates are bottom-up.
              y: (shot.height - line.bbox.y1) / RENDER_SCALE,
              fontSize: Math.max(6, heightPx / RENDER_SCALE),
            });
          }
        }
      }

      pages.push({
        pageNumber: shot.pageNumber,
        width: shot.width / RENDER_SCALE,
        height: shot.height / RENDER_SCALE,
        scale: shot.scale,
        image: shot.data,
        lines,
        text: result.data.text,
      });
    }
  } finally {
    await worker.terminate();
  }

  return { pages, fullText: pages.map((p) => p.text).join("\n\n") };
}

// Rebuilds the PDF with each original page rasterized as the visual
// background and the raw OCR'd lines drawn on top at ~0 opacity — invisible
// to the eye but present as real text content, so the PDF becomes selectable
// and searchable without changing how the scanned page looks.
export async function generateSearchablePdf(pages: OcrPage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  for (const ocrPage of pages) {
    const page = doc.addPage([ocrPage.width, ocrPage.height]);
    const image = await doc.embedPng(ocrPage.image);
    page.drawImage(image, { x: 0, y: 0, width: ocrPage.width, height: ocrPage.height });

    for (const line of ocrPage.lines) {
      try {
        page.drawText(line.text, {
          x: line.x,
          y: line.y,
          size: line.fontSize,
          color: rgb(0, 0, 0),
          opacity: 0,
        });
      } catch {
        // Skip lines containing characters the base font can't encode.
      }
    }
  }

  return doc.save();
}
