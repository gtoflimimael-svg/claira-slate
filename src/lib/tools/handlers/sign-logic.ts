import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { sniffImageType } from "@/lib/tools/image-format";

export interface SignPlacement {
  page: number | "all" | number[]; // 1-indexed
  x: number; // top-left origin, matching the on-page editor
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export interface SignConfig {
  signatureData: string; // data: URI or raw base64
  placement: SignPlacement;
  addDateStamp: boolean;
  dateFormat: string; // tokens: DD, MM, YYYY
}

export interface SignResult {
  buffer: Buffer;
  pagesSigned: number;
}

function decodeSignatureImage(signatureData: string): Buffer {
  const match = signatureData.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
  const base64 = match ? match[1] : signatureData;
  return Buffer.from(base64, "base64");
}

function formatDate(format: string, date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return format.replace(/YYYY/g, yyyy).replace(/DD/g, dd).replace(/MM/g, mm);
}

function resolvePages(placement: SignPlacement, pageCount: number): number[] {
  if (placement.page === "all") return Array.from({ length: pageCount }, (_, i) => i + 1);
  if (Array.isArray(placement.page)) return placement.page.filter((p) => p >= 1 && p <= pageCount);
  return [placement.page].filter((p) => p >= 1 && p <= pageCount);
}

export async function runSign(fileBuffer: Buffer, config: SignConfig): Promise<SignResult> {
  const doc = await PDFDocument.load(fileBuffer);
  const pages = doc.getPages();
  const imageBytes = decodeSignatureImage(config.signatureData);
  const type = sniffImageType(imageBytes);
  if (!type || (type !== "png" && type !== "jpg")) {
    throw new Error("Signature image must be a PNG or JPEG.");
  }
  const embedded = type === "png" ? await doc.embedPng(imageBytes) : await doc.embedJpg(imageBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const targetPages = resolvePages(config.placement, pages.length);
  const { x, y, width, height, opacity } = config.placement;
  const dateText = config.addDateStamp ? formatDate(config.dateFormat || "DD/MM/YYYY", new Date()) : null;

  for (const pageNum of targetPages) {
    const page = pages[pageNum - 1];
    const { height: pageHeight } = page.getSize();
    const drawY = pageHeight - y - height; // top-left input -> pdf-lib's bottom-left origin
    page.drawImage(embedded, { x, y: drawY, width, height, opacity });
    if (dateText) {
      page.drawText(dateText, { x, y: drawY - 14, size: 10, font, color: rgb(0.3, 0.3, 0.3), opacity });
    }
  }

  const buffer = Buffer.from(await doc.save());
  return { buffer, pagesSigned: targetPages.length };
}
