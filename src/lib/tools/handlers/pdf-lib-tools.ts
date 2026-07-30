import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import sharp from "sharp";
import JSZip from "jszip";
import { loadPdfDoc, stampEveryPage } from "@/lib/tools/stamp";
import { parsePageRanges } from "@/lib/tools/page-ranges";
import type { ToolInput, ToolOutput } from "@/lib/tools/types";

async function loadDocs(buffers: Buffer[]): Promise<PDFDocument[]> {
  return Promise.all(buffers.map((b) => loadPdfDoc(b)));
}

export async function merge({ files }: ToolInput): Promise<ToolOutput> {
  const docs = await loadDocs(files);
  const out = await PDFDocument.create();
  for (const doc of docs) {
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return { buffer: Buffer.from(await out.save()), filename: "merged.pdf", mimeType: "application/pdf" };
}

export async function split({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const total = doc.getPageCount();
  const breakpoints = params.pageRanges
    ? parsePageRanges(params.pageRanges, total).filter((i) => i > 0)
    : Array.from({ length: total - 1 }, (_, i) => i + 1);

  const bounds = [0, ...breakpoints, total];
  const zip = new JSZip();
  for (let i = 0; i < bounds.length - 1; i++) {
    const start = bounds[i];
    const end = bounds[i + 1];
    if (start >= end) continue;
    const out = await PDFDocument.create();
    const pages = await out.copyPages(doc, Array.from({ length: end - start }, (_, j) => start + j));
    pages.forEach((p) => out.addPage(p));
    zip.file(`part-${i + 1}.pdf`, await out.save());
  }
  return { buffer: await zip.generateAsync({ type: "nodebuffer" }), filename: "split.zip", mimeType: "application/zip" };
}

export async function reorder({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const total = doc.getPageCount();
  const order = (params.order ?? "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((n) => Number.isFinite(n) && n >= 0 && n < total);
  const indices = order.length === total ? order : doc.getPageIndices();

  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, indices);
  pages.forEach((p) => out.addPage(p));
  return { buffer: Buffer.from(await out.save()), filename: "reordered.pdf", mimeType: "application/pdf" };
}

export async function rotate({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const delta = parseInt(params.degrees ?? "90", 10) || 90;
  for (const page of doc.getPages()) {
    page.setRotation(degrees((page.getRotation().angle + delta) % 360));
  }
  return { buffer: Buffer.from(await doc.save()), filename: "rotated.pdf", mimeType: "application/pdf" };
}

export async function extractPages({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const indices = parsePageRanges(params.pageRanges ?? "", doc.getPageCount());
  const out = await PDFDocument.create();
  const pages = await out.copyPages(doc, indices.length ? indices : doc.getPageIndices());
  pages.forEach((p) => out.addPage(p));
  return { buffer: Buffer.from(await out.save()), filename: "extracted.pdf", mimeType: "application/pdf" };
}

export async function deletePages({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const toDelete = parsePageRanges(params.pageRanges ?? "", doc.getPageCount());
  [...toDelete].sort((a, b) => b - a).forEach((i) => doc.removePage(i));
  return { buffer: Buffer.from(await doc.save()), filename: "deleted.pdf", mimeType: "application/pdf" };
}

export async function flatten({ files }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  try {
    doc.getForm().flatten();
  } catch {
    // No AcroForm fields to flatten — the PDF is returned unchanged.
  }
  return { buffer: Buffer.from(await doc.save()), filename: "flattened.pdf", mimeType: "application/pdf" };
}

export async function repair({ files }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  return { buffer: Buffer.from(await doc.save()), filename: "repaired.pdf", mimeType: "application/pdf" };
}

export async function watermark({ files, params }: ToolInput): Promise<ToolOutput> {
  const text = params.text || "WATERMARK";
  const bytes = await stampEveryPage(files[0], (page, font) => {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 8;
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.35,
      rotate: degrees(45),
    });
  });
  return { buffer: Buffer.from(bytes), filename: "watermarked.pdf", mimeType: "application/pdf" };
}

export async function numberPages({ files, params }: ToolInput): Promise<ToolOutput> {
  const startAt = parseInt(params.startAt ?? "1", 10) || 1;
  const bytes = await stampEveryPage(files[0], (page, font, i, total) => {
    const { width } = page.getSize();
    const label = `Page ${i + startAt} of ${total + startAt - 1}`;
    const size = 10;
    const textWidth = font.widthOfTextAtSize(label, size);
    page.drawText(label, { x: width / 2 - textWidth / 2, y: 24, size, font, color: rgb(0.3, 0.3, 0.3) });
  });
  return { buffer: Buffer.from(bytes), filename: "numbered.pdf", mimeType: "application/pdf" };
}

export async function headerFooter({ files, params }: ToolInput): Promise<ToolOutput> {
  const header = params.header ?? "";
  const footer = params.footer ?? "";
  const bytes = await stampEveryPage(files[0], (page, font) => {
    const { width, height } = page.getSize();
    const size = 10;
    if (header) {
      const w = font.widthOfTextAtSize(header, size);
      page.drawText(header, { x: width / 2 - w / 2, y: height - 30, size, font, color: rgb(0.3, 0.3, 0.3) });
    }
    if (footer) {
      const w = font.widthOfTextAtSize(footer, size);
      page.drawText(footer, { x: width / 2 - w / 2, y: 24, size, font, color: rgb(0.3, 0.3, 0.3) });
    }
  });
  return { buffer: Buffer.from(bytes), filename: "stamped.pdf", mimeType: "application/pdf" };
}

export async function jpgToPdf({ files }: ToolInput): Promise<ToolOutput> {
  const doc = await PDFDocument.create();
  for (const file of files) {
    const jpeg = await sharp(file).jpeg().toBuffer();
    const meta = await sharp(jpeg).metadata();
    const width = meta.width ?? 612;
    const height = meta.height ?? 792;
    const image = await doc.embedJpg(jpeg);
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  return { buffer: Buffer.from(await doc.save()), filename: "images.pdf", mimeType: "application/pdf" };
}

export async function crop({ files, params }: ToolInput): Promise<ToolOutput> {
  const [doc] = await loadDocs(files);
  const marginPercent = Math.min(45, Math.max(0, parseFloat(params.marginPercent ?? "10") || 10));
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const mx = (width * marginPercent) / 100;
    const my = (height * marginPercent) / 100;
    page.setCropBox(mx, my, width - 2 * mx, height - 2 * my);
  }
  return { buffer: Buffer.from(await doc.save()), filename: "cropped.pdf", mimeType: "application/pdf" };
}

export async function sign({ files, params }: ToolInput): Promise<ToolOutput> {
  const name = params.signature || "Signed";
  const [doc] = await loadDocs(files);
  const font = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const pages = doc.getPages();
  const page = pages[pages.length - 1];
  const { width } = page.getSize();
  const size = 22;
  const textWidth = font.widthOfTextAtSize(name, size);
  page.drawText(name, { x: width - textWidth - 60, y: 60, size, font, color: rgb(0.15, 0.15, 0.5) });
  page.drawLine({
    start: { x: width - textWidth - 62, y: 54 },
    end: { x: width - 40, y: 54 },
    thickness: 0.75,
    color: rgb(0.4, 0.4, 0.4),
  });
  return { buffer: Buffer.from(await doc.save()), filename: "signed.pdf", mimeType: "application/pdf" };
}

export async function annotate({ files, params }: ToolInput): Promise<ToolOutput> {
  const comment = params.comment || "Note";
  const pageNum = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const [doc] = await loadDocs(files);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const page = pages[Math.min(pageNum, pages.length) - 1];
  const { width, height } = page.getSize();
  const boxWidth = Math.min(220, width - 40);
  page.drawRectangle({
    x: width - boxWidth - 20,
    y: height - 80,
    width: boxWidth,
    height: 50,
    color: rgb(1, 0.92, 0.4),
    opacity: 0.85,
    borderColor: rgb(0.8, 0.7, 0.1),
    borderWidth: 1,
  });
  page.drawText(comment, {
    x: width - boxWidth - 12,
    y: height - 55,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.1),
    maxWidth: boxWidth - 16,
  });
  return { buffer: Buffer.from(await doc.save()), filename: "annotated.pdf", mimeType: "application/pdf" };
}
