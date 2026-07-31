import { PDFDocument } from "pdf-lib";
import { rasterizePdfPages, buildPdfFromImages, recompressJpeg } from "@/lib/tools/raster";

export interface FlattenConfig {
  flattenForms: boolean;
  flattenAnnotations: boolean;
  flattenLayers: boolean;
  removeHiddenLayers: boolean;
}

export interface FlattenResult {
  buffer: Buffer;
  originalSize: number;
  size: number;
  pages: number;
  fieldsFlattened: number;
  annotationsFlattened: number;
}

// High quality — this operation isn't primarily about shrinking file size,
// it's about baking content in permanently, so keep visual fidelity close
// to lossless.
const RASTER_QUALITY = 92;

export async function runFlatten(fileBuffer: Buffer, config: FlattenConfig): Promise<FlattenResult> {
  const doc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true, throwOnInvalidObject: false });

  let fieldsFlattened = 0;
  try {
    fieldsFlattened = doc.getForm().getFields().length;
  } catch {
    // No AcroForm.
  }

  let annotationsFlattened = 0;
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (annots) annotationsFlattened += annots.size();
  }

  // pdf-lib has no API to bake an annotation's appearance into page content
  // or to drop hidden optional-content-group layers — rasterizing the
  // rendered page is the only way to actually achieve either, and as a
  // side effect it also flattens forms and drops anything not visible
  // (satisfying "remove hidden layers" for free).
  const needsRaster = config.flattenAnnotations || config.flattenLayers || config.removeHiddenLayers;

  if (needsRaster) {
    const pages = await rasterizePdfPages(fileBuffer);
    const jpegPages = await Promise.all(
      pages.map(async (p) => ({ width: p.width, height: p.height, jpeg: await recompressJpeg(p.png, RASTER_QUALITY, false) }))
    );
    const buffer = Buffer.from(await buildPdfFromImages(jpegPages));
    return { buffer, originalSize: fileBuffer.byteLength, size: buffer.byteLength, pages: pages.length, fieldsFlattened, annotationsFlattened };
  }

  if (config.flattenForms) {
    try {
      doc.getForm().flatten();
    } catch {
      // No AcroForm fields to flatten.
    }
  }

  const buffer = Buffer.from(await doc.save());
  return {
    buffer,
    originalSize: fileBuffer.byteLength,
    size: buffer.byteLength,
    pages: doc.getPageCount(),
    fieldsFlattened: config.flattenForms ? fieldsFlattened : 0,
    annotationsFlattened: 0,
  };
}
