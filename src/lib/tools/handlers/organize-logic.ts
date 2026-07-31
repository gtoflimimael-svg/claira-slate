import { PDFDocument, degrees } from "pdf-lib";
import { loadPdfDoc } from "@/lib/tools/stamp";

export interface OrganizePageSpec {
  fileIndex: number; // position in the `buffers` array
  pageIndex: number; // 0-indexed page within that source PDF
  rotation: number; // 0 | 90 | 180 | 270, added on top of the page's existing rotation
}

export interface OrganizeConfig {
  pageOrder: OrganizePageSpec[];
}

export interface OrganizeResult {
  buffer: Buffer;
  pages: number;
}

export async function runOrganize(buffers: Buffer[], config: OrganizeConfig): Promise<OrganizeResult> {
  if (buffers.length === 0) throw new Error("No source PDFs provided.");
  if (config.pageOrder.length === 0) throw new Error("No pages to organize.");

  const docs = await Promise.all(buffers.map((b) => loadPdfDoc(b)));
  for (const spec of config.pageOrder) {
    const doc = docs[spec.fileIndex];
    if (!doc) throw new Error(`Invalid source file index ${spec.fileIndex}.`);
    if (spec.pageIndex < 0 || spec.pageIndex >= doc.getPageCount()) {
      throw new Error(`Invalid page index ${spec.pageIndex} for file ${spec.fileIndex}.`);
    }
  }

  const out = await PDFDocument.create();

  // pdf-lib's copyPages is far cheaper when copying many pages from the same
  // source document in one call than copying one page at a time in a loop —
  // so group by source doc first. A duplicated page appears twice in the
  // same file's index list (once per occurrence in pageOrder, in order), and
  // copyPages returns a distinct PDFPage object per occurrence rather than
  // deduping repeated indices, so each duplicate can carry its own rotation.
  // A per-file FIFO cursor then hands out those copies in the same relative
  // order they were requested, reassembling the caller's interleaved order.
  const byFile = new Map<number, number[]>();
  for (const spec of config.pageOrder) {
    if (!byFile.has(spec.fileIndex)) byFile.set(spec.fileIndex, []);
    byFile.get(spec.fileIndex)!.push(spec.pageIndex);
  }

  const copiedByFile = new Map<number, Awaited<ReturnType<typeof out.copyPages>>>();
  const cursorByFile = new Map<number, number>();
  for (const [fileIndex, pageIndices] of byFile) {
    copiedByFile.set(fileIndex, await out.copyPages(docs[fileIndex], pageIndices));
    cursorByFile.set(fileIndex, 0);
  }

  for (const spec of config.pageOrder) {
    const copied = copiedByFile.get(spec.fileIndex)!;
    const cursor = cursorByFile.get(spec.fileIndex)!;
    const page = copied[cursor];
    cursorByFile.set(spec.fileIndex, cursor + 1);
    if (spec.rotation) page.setRotation(degrees((page.getRotation().angle + spec.rotation) % 360));
    out.addPage(page);
  }

  const buffer = Buffer.from(await out.save());
  return { buffer, pages: config.pageOrder.length };
}
