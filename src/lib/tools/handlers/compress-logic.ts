import { rasterizePdfPages, buildPdfFromImages, recompressJpeg } from "@/lib/tools/raster";

export type CompressLevel = "extreme" | "recommended" | "less";

export const LEVEL_QUALITY: Record<CompressLevel, number> = { extreme: 30, recommended: 60, less: 85 };

// Beyond the lower JPEG quality, Extreme also shrinks the raster pixel
// dimensions themselves ("resize large images" per spec) for extra savings —
// appropriate for its web/email use case, where print-grade resolution isn't
// needed. Less/Recommended keep the page's rendered resolution untouched.
const EXTREME_SCALE = 0.7;

export interface CompressConfig {
  level: CompressLevel;
  quality?: number; // 0-100, overrides the level's preset quality (custom, paid plans only)
}

export interface CompressFileResult {
  buffer: Buffer;
  filename: string;
  originalSize: number;
  size: number;
  pages: number;
}

async function compressPage(png: Buffer, quality: number, shrink: boolean): Promise<Buffer> {
  if (!shrink) return recompressJpeg(png, quality, false);
  const sharpLib = (await import("sharp")).default;
  const image = sharpLib(png);
  const meta = await image.metadata();
  const targetWidth = meta.width ? Math.round(meta.width * EXTREME_SCALE) : undefined;
  const resized = targetWidth ? await image.resize({ width: targetWidth }).toBuffer() : png;
  return recompressJpeg(resized, quality, false);
}

export async function runCompress(fileBuffer: Buffer, filename: string, config: CompressConfig): Promise<CompressFileResult> {
  const quality = config.quality ?? LEVEL_QUALITY[config.level];
  // Only shrink pixel dimensions for the actual Extreme preset — a custom
  // quality value (Pro slider) only ever adjusts JPEG quality, matching the
  // spec's implementation notes (resize is Extreme-specific).
  const shrink = config.level === "extreme" && config.quality === undefined;

  const pages = await rasterizePdfPages(fileBuffer);
  const jpegPages = await Promise.all(
    pages.map(async (p) => ({
      width: p.width,
      height: p.height,
      jpeg: await compressPage(p.png, quality, shrink),
    }))
  );
  const buffer = Buffer.from(await buildPdfFromImages(jpegPages));

  return {
    buffer,
    filename,
    originalSize: fileBuffer.byteLength,
    size: buffer.byteLength,
    pages: pages.length,
  };
}
