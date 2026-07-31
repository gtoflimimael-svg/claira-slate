import { PDFParse } from "pdf-parse";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

export interface RasterPage {
  pageNumber: number;
  width: number;
  height: number;
  png: Buffer;
}

const RENDER_SCALE = 1.5;

export async function rasterizePdfPages(buffer: Buffer): Promise<RasterPage[]> {
  const parser = new PDFParse({ data: buffer });
  try {
    const shots = await parser.getScreenshot({ scale: RENDER_SCALE, imageBuffer: true, imageDataUrl: false });
    return shots.pages.map((p) => ({
      pageNumber: p.pageNumber,
      width: p.width / RENDER_SCALE,
      height: p.height / RENDER_SCALE,
      png: Buffer.from(p.data),
    }));
  } finally {
    await parser.destroy();
  }
}

/** Rebuilds a PDF from a set of per-page images, one page per image, at its original page size. */
export async function buildPdfFromImages(pages: { width: number; height: number; jpeg: Buffer }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const page of pages) {
    const image = await doc.embedJpg(page.jpeg);
    const pdfPage = doc.addPage([page.width, page.height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
  }
  return doc.save();
}

// pdf-lib's JpegEmbedder does `new DataView(buf.buffer)`, which reads from
// byte 0 of the Buffer's *underlying* ArrayBuffer rather than its byteOffset.
// Small buffers (ours are ~1-2KB) are routinely slices of Node's shared
// Buffer pool, so that misreads garbage and throws "SOI not found in JPEG"
// even though the buffer's own bytes are a valid JPEG. Copying into a
// freshly allocated, exclusively-owned ArrayBuffer guarantees byteOffset 0.
function standaloneBuffer(buf: Buffer): Buffer {
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(buf);
  return Buffer.from(copy);
}

export async function recompressJpeg(png: Buffer, quality: number, grayscale = false): Promise<Buffer> {
  let pipeline = sharp(png);
  if (grayscale) pipeline = pipeline.grayscale();
  const jpeg = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  return standaloneBuffer(jpeg);
}
