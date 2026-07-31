import { PDFDocument, PDFName, PDFDict } from "pdf-lib";

export type OptimizeTarget = "web" | "email" | "archive";

export interface OptimizeConfig {
  removeMetadata: boolean;
  removeThumbnails: boolean;
  flattenForms: boolean;
  removeJS: boolean;
  removeAnnotations: boolean;
  target: OptimizeTarget;
}

export interface OptimizeResult {
  buffer: Buffer;
  originalSize: number;
  size: number;
  pages: number;
}

// Note on "linearization": true Fast Web View linearization (reordering
// objects so the first page can render before the rest of the file
// downloads, plus hint tables) isn't something pdf-lib exposes an API for.
// What this does instead — stripping metadata/thumbnails/JS/annotations and
// re-saving without object streams — is real cleanup that shrinks the file
// and simplifies its object graph, which is the practically-achievable part
// of "optimize for web" with the tooling available here.
export async function runOptimize(fileBuffer: Buffer, config: OptimizeConfig): Promise<OptimizeResult> {
  const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true, throwOnInvalidObject: false });

  if (config.removeMetadata) {
    doc.setTitle("");
    doc.setAuthor("");
    doc.setSubject("");
    doc.setKeywords([]);
    doc.setProducer("");
    doc.setCreator("");
  }

  if (config.removeThumbnails) {
    for (const page of doc.getPages()) {
      page.node.delete(PDFName.of("Thumb"));
    }
  }

  if (config.flattenForms) {
    try {
      doc.getForm().flatten();
    } catch {
      // No AcroForm fields to flatten.
    }
  }

  if (config.removeJS) {
    doc.catalog.delete(PDFName.of("OpenAction"));
    const names = doc.catalog.lookup(PDFName.of("Names"));
    if (names instanceof PDFDict) names.delete(PDFName.of("JavaScript"));
    for (const page of doc.getPages()) {
      page.node.delete(PDFName.of("AA"));
    }
  }

  if (config.removeAnnotations) {
    for (const page of doc.getPages()) {
      page.node.delete(PDFName.of("Annots"));
    }
  }

  const buffer = Buffer.from(await doc.save({ useObjectStreams: false }));
  return { buffer, originalSize: fileBuffer.byteLength, size: buffer.byteLength, pages: doc.getPageCount() };
}
