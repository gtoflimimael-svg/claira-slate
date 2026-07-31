import { rasterizePdfPages, buildPdfFromImages } from "@/lib/tools/raster";

export type GrayscaleMode = "grayscale" | "blackwhite" | "sepia";

export interface GrayscaleConfig {
  mode: GrayscaleMode;
  keepTextBlack: boolean;
  preserveImageQuality: boolean;
  optimizeForPrint: boolean;
}

export interface GrayscaleResult {
  buffer: Buffer;
  originalSize: number;
  size: number;
  pages: number;
  imagesConverted: number;
}

// Sepia is a warm tint applied on top of a grayscale base — the same
// technique most simple "sepia filter" implementations use.
const SEPIA_TINT = { r: 112, g: 66, b: 20 };

// See raster.ts's `standaloneBuffer` for why this copy is necessary: pdf-lib's
// JpegEmbedder reads from byte 0 of the Buffer's underlying ArrayBuffer
// rather than its byteOffset, which misreads small buffers sliced from
// Node's shared pool. Any buffer built here must go through the same fix
// before being hardcoded into a PDF.
function standaloneBuffer(buf: Buffer): Buffer {
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(buf);
  return Buffer.from(copy);
}

async function convertPage(png: Buffer, config: GrayscaleConfig): Promise<Buffer> {
  const sharpLib = (await import("sharp")).default;
  let pipeline = sharpLib(png);

  // sharp's tint() doesn't compose with a preceding grayscale() call —
  // chaining grayscale().tint() empirically produces no visible tint at all
  // (verified: a mid-gray and a colored input both pass through unchanged).
  // tint() on its own already desaturates toward the given hue while
  // preserving luminance, which *is* the sepia effect, so sepia applies it
  // directly instead of stacking it on top of grayscale().
  if (config.mode === "sepia") {
    pipeline = pipeline.tint(SEPIA_TINT);
  } else {
    pipeline = pipeline.grayscale();
    if (config.mode === "blackwhite") pipeline = pipeline.threshold(128);
  }

  // "Keep colored text as black": a true text/image split isn't possible
  // once the page is rasterized to a single image — normalizing contrast is
  // a real, if approximate, way to push dark (typically text) pixels closer
  // to pure black without a full text-layer analysis. Composes fine after
  // tint() (verified) — doesn't wash out the sepia cast.
  if (config.keepTextBlack) pipeline = pipeline.normalize();
  if (config.optimizeForPrint) pipeline = pipeline.sharpen();

  const quality = config.preserveImageQuality ? 90 : 75;
  const jpeg = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  return standaloneBuffer(jpeg);
}

export async function runGrayscale(fileBuffer: Buffer, config: GrayscaleConfig): Promise<GrayscaleResult> {
  const pages = await rasterizePdfPages(fileBuffer);
  const jpegPages = await Promise.all(
    pages.map(async (p) => ({ width: p.width, height: p.height, jpeg: await convertPage(p.png, config) }))
  );
  const buffer = Buffer.from(await buildPdfFromImages(jpegPages));
  return {
    buffer,
    originalSize: fileBuffer.byteLength,
    size: buffer.byteLength,
    pages: pages.length,
    imagesConverted: pages.length,
  };
}
