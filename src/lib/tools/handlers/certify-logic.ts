import { PDFDocument as PdfLibDocument, PDFName } from "pdf-lib";
import { convertToPdfA, checkGhostscriptAvailable } from "@/lib/tools/ghostscript";

export type PdfAStandard = "pdfa1b" | "pdfa2b" | "pdfa3b";

export interface ComplianceCheck {
  fontsEmbedded: boolean;
  colorSpaceIsRgb: boolean;
  hasJavaScript: boolean;
  hasTransparency: boolean;
}

export interface CertifyResult {
  buffer: Buffer;
  compliance: ComplianceCheck;
  fullyCompliant: boolean;
}

const PART_NUMBER: Record<PdfAStandard, 1 | 2 | 3> = { pdfa1b: 1, pdfa2b: 2, pdfa3b: 3 };

export async function checkCompliance(fileBuffer: Buffer): Promise<ComplianceCheck> {
  const mupdf = await import("mupdf");
  const opened = mupdf.Document.openDocument(fileBuffer, "application/pdf");
  const doc = opened.asPDF();
  if (!doc) throw new Error("That file isn't a valid PDF.");

  const trailer = doc.getTrailer();
  const root = trailer.get("Root");
  const namesJs = root.get("Names", "JavaScript");
  const openAction = root.get("OpenAction");
  // Every chained .get() must be guarded by isNull() first — PDFObject.Null
  // has no owning document, so calling .get() on it (not just reading it)
  // throws rather than returning another Null.
  const openActionIsJs = !openAction.isNull() && !openAction.get("S").isNull() && openAction.get("S").asName() === "JavaScript";
  let hasJavaScript = !namesJs.isNull() || openActionIsJs;

  let fontsEmbedded = true;
  let colorSpaceIsRgb = true;
  let hasTransparency = false;

  const pageCount = doc.countPages();
  for (let i = 0; i < pageCount; i++) {
    const pageObj = doc.findPage(i);
    const resources = pageObj.get("Resources");
    if (resources.isNull()) continue;

    const aa = pageObj.get("AA");
    if (!aa.isNull()) hasJavaScript = true;

    const fonts = resources.get("Font");
    if (!fonts.isNull()) {
      fonts.forEach((fontRef) => {
        const descriptor = fontRef.get("FontDescriptor");
        if (descriptor.isNull()) return; // base-14 fonts have no descriptor; treated as acceptable
        const hasFile = !descriptor.get("FontFile").isNull() || !descriptor.get("FontFile2").isNull() || !descriptor.get("FontFile3").isNull();
        if (!hasFile) fontsEmbedded = false;
      });
    }

    const extGStates = resources.get("ExtGState");
    if (!extGStates.isNull()) {
      extGStates.forEach((gs) => {
        const ca = gs.get("ca");
        const smask = gs.get("SMask");
        if ((!ca.isNull() && ca.asNumber() < 1) || (!smask.isNull() && smask.asName?.() !== "None")) {
          hasTransparency = true;
        }
      });
    }

    const colorSpaces = resources.get("ColorSpace");
    if (!colorSpaces.isNull()) {
      colorSpaces.forEach((cs) => {
        const name = cs.isArray() ? cs.get(0).asName?.() : cs.asName?.();
        if (name === "DeviceCMYK" || name === "DeviceN" || name === "Separation" || name === "Lab") colorSpaceIsRgb = false;
      });
    }
  }

  return { fontsEmbedded, colorSpaceIsRgb, hasJavaScript, hasTransparency };
}

export async function stripJavaScriptFallback(fileBuffer: Buffer): Promise<Buffer> {
  const doc = await PdfLibDocument.load(fileBuffer, { ignoreEncryption: true });
  const catalog = doc.catalog;
  catalog.delete(PDFName.of("OpenAction"));
  const names = catalog.lookup(PDFName.of("Names"));
  if (names && "delete" in names) {
    (names as { delete: (key: unknown) => void }).delete(PDFName.of("JavaScript"));
  }
  for (const page of doc.getPages()) {
    page.node.delete(PDFName.of("AA"));
  }
  doc.setProducer("Claira Slate");
  doc.setCreator("Claira Slate");
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function runCertify(fileBuffer: Buffer, standard: PdfAStandard): Promise<CertifyResult> {
  const compliance = await checkCompliance(fileBuffer);
  const part = PART_NUMBER[standard];

  if (await checkGhostscriptAvailable()) {
    const converted = await convertToPdfA(fileBuffer, part);
    if (!converted) throw new Error("PDF/A conversion isn't available on this server right now.");
    return { buffer: converted, compliance, fullyCompliant: true };
  }

  // Best-effort fallback: real JavaScript removal, but no ICC profile
  // embedding or true archival validation — Ghostscript does the actual
  // spec-compliant conversion when it's available.
  const buffer = await stripJavaScriptFallback(fileBuffer);
  return { buffer, compliance, fullyCompliant: false };
}
