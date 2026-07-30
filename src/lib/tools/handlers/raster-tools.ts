import JSZip from "jszip";
import { rasterizePdfPages, buildPdfFromImages, recompressJpeg } from "@/lib/tools/raster";
import { parsePageRanges } from "@/lib/tools/page-ranges";
import type { ToolInput, ToolOutput } from "@/lib/tools/types";

async function rasterRebuild(buffer: Buffer, quality: number, grayscale: boolean): Promise<Buffer> {
  const pages = await rasterizePdfPages(buffer);
  const jpegPages = await Promise.all(
    pages.map(async (p) => ({
      width: p.width,
      height: p.height,
      jpeg: await recompressJpeg(p.png, quality, grayscale),
    }))
  );
  return Buffer.from(await buildPdfFromImages(jpegPages));
}

export async function compress({ files }: ToolInput): Promise<ToolOutput> {
  const buffer = await rasterRebuild(files[0], 45, false);
  return { buffer, filename: "compressed.pdf", mimeType: "application/pdf" };
}

export async function optimize({ files }: ToolInput): Promise<ToolOutput> {
  const buffer = await rasterRebuild(files[0], 65, false);
  return { buffer, filename: "optimized.pdf", mimeType: "application/pdf" };
}

export async function grayscale({ files }: ToolInput): Promise<ToolOutput> {
  const buffer = await rasterRebuild(files[0], 80, true);
  return { buffer, filename: "grayscale.pdf", mimeType: "application/pdf" };
}

export async function pdfToJpg({ files }: ToolInput): Promise<ToolOutput> {
  const pages = await rasterizePdfPages(files[0]);
  if (pages.length === 1) {
    const jpeg = await recompressJpeg(pages[0].png, 85, false);
    return { buffer: jpeg, filename: "page-1.jpg", mimeType: "image/jpeg" };
  }
  const zip = new JSZip();
  for (const page of pages) {
    zip.file(`page-${page.pageNumber}.jpg`, await recompressJpeg(page.png, 85, false));
  }
  return { buffer: await zip.generateAsync({ type: "nodebuffer" }), filename: "pages.zip", mimeType: "application/zip" };
}

export async function redact({ files, params }: ToolInput): Promise<ToolOutput> {
  const pages = await rasterizePdfPages(files[0]);
  const totalPages = pages.length;
  const redactSet = new Set(parsePageRanges(params.pageRanges ?? "", totalPages).map((i) => i + 1));

  const jpegPages = await Promise.all(
    pages.map(async (p) => {
      if (!redactSet.has(p.pageNumber)) {
        return { width: p.width, height: p.height, jpeg: await recompressJpeg(p.png, 80, false) };
      }
      const sharp = (await import("sharp")).default;
      const blacked = await sharp({
        create: { width: Math.round(p.width), height: Math.round(p.height), channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .jpeg({ quality: 80 })
        .toBuffer();
      return { width: p.width, height: p.height, jpeg: blacked };
    })
  );
  const buffer = Buffer.from(await buildPdfFromImages(jpegPages));
  return { buffer, filename: "redacted.pdf", mimeType: "application/pdf" };
}
