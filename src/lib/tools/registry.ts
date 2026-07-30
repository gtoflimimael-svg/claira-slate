export type ToolTechnique = "pdf-lib" | "raster" | "office" | "stub";
export type OutputKind = "pdf" | "zip" | "image" | "docx" | "xlsx" | "pptx";

export interface ToolField {
  name: string;
  label: string;
  type: "text" | "number" | "password";
  placeholder?: string;
  defaultValue?: string;
}

export interface ToolConfig {
  slug: string;
  multi: boolean;
  outputKind: OutputKind;
  technique: ToolTechnique;
  fields?: ToolField[];
  /** Only set for tools outside the translated 26 — not part of the `tools` messages namespace. */
  fallback?: { name: string; desc: string };
}

export const TOOL_REGISTRY: ToolConfig[] = [
  { slug: "merge", multi: true, outputKind: "pdf", technique: "pdf-lib" },
  { slug: "split", multi: false, outputKind: "zip", technique: "pdf-lib",
    fields: [{ name: "pageRanges", label: "Split at (page numbers, comma-separated)", type: "text", placeholder: "e.g. 3,7,12" }] },
  { slug: "reorder", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "order", label: "New page order (comma-separated)", type: "text", placeholder: "e.g. 3,1,2,4" }] },
  { slug: "rotate", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "degrees", label: "Rotation", type: "number", defaultValue: "90" }] },
  { slug: "extract-pages", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "pageRanges", label: "Pages to extract", type: "text", placeholder: "e.g. 1-3,5" }] },
  { slug: "delete-pages", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "pageRanges", label: "Pages to delete", type: "text", placeholder: "e.g. 2,4-6" }] },
  { slug: "compress", multi: false, outputKind: "pdf", technique: "raster" },
  { slug: "repair", multi: false, outputKind: "pdf", technique: "pdf-lib" },
  { slug: "optimize", multi: false, outputKind: "pdf", technique: "raster" },
  { slug: "flatten", multi: false, outputKind: "pdf", technique: "pdf-lib" },
  { slug: "pdf-to-word", multi: false, outputKind: "docx", technique: "office" },
  { slug: "pdf-to-excel", multi: false, outputKind: "xlsx", technique: "office" },
  { slug: "pdf-to-ppt", multi: false, outputKind: "pptx", technique: "office" },
  { slug: "pdf-to-jpg", multi: false, outputKind: "zip", technique: "raster" },
  { slug: "jpg-to-pdf", multi: true, outputKind: "pdf", technique: "pdf-lib" },
  { slug: "html-to-pdf", multi: false, outputKind: "pdf", technique: "office" },
  { slug: "word-to-pdf", multi: false, outputKind: "pdf", technique: "office",
    fallback: { name: "Word to PDF", desc: "Convert a Word document to PDF." } },
  { slug: "excel-to-pdf", multi: false, outputKind: "pdf", technique: "office",
    fallback: { name: "Excel to PDF", desc: "Convert a spreadsheet to PDF." } },
  { slug: "ppt-to-pdf", multi: false, outputKind: "pdf", technique: "office",
    fallback: { name: "PowerPoint to PDF", desc: "Convert a presentation to PDF." } },
  { slug: "protect", multi: false, outputKind: "pdf", technique: "stub",
    fields: [{ name: "password", label: "Password", type: "password" }] },
  { slug: "unlock", multi: false, outputKind: "pdf", technique: "stub",
    fields: [{ name: "password", label: "Current password", type: "password" }] },
  { slug: "sign", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "signature", label: "Type your name", type: "text", placeholder: "Your full name" }] },
  { slug: "redact", multi: false, outputKind: "pdf", technique: "raster",
    fields: [{ name: "pageRanges", label: "Pages to redact (fully blacked out)", type: "text", placeholder: "e.g. 2,5" }] },
  { slug: "certify", multi: false, outputKind: "pdf", technique: "stub",
    fallback: { name: "Certify PDF", desc: "Add a certifying signature." } },
  { slug: "watermark", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "text", label: "Watermark text", type: "text", placeholder: "e.g. CONFIDENTIAL" }] },
  { slug: "edit-text", multi: false, outputKind: "pdf", technique: "stub" },
  { slug: "number-pages", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "startAt", label: "Start numbering at", type: "number", defaultValue: "1" }] },
  { slug: "header-footer", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fallback: { name: "Header & footer", desc: "Add running header and footer text." },
    fields: [
      { name: "header", label: "Header text", type: "text" },
      { name: "footer", label: "Footer text", type: "text" },
    ] },
  { slug: "crop", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [{ name: "marginPercent", label: "Trim margin (%)", type: "number", defaultValue: "10" }] },
  { slug: "grayscale", multi: false, outputKind: "pdf", technique: "raster",
    fallback: { name: "Grayscale PDF", desc: "Convert every page to grayscale." } },
  { slug: "annotate", multi: false, outputKind: "pdf", technique: "pdf-lib",
    fields: [
      { name: "comment", label: "Comment text", type: "text" },
      { name: "page", label: "Page number", type: "number", defaultValue: "1" },
    ] },
];

const REGISTRY_BY_SLUG = new Map(TOOL_REGISTRY.map((t) => [t.slug, t]));

export function getToolConfig(slug: string): ToolConfig | undefined {
  return REGISTRY_BY_SLUG.get(slug);
}
