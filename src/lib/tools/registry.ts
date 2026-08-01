export type ToolTechnique = "pdf-lib" | "raster" | "office" | "stub";
export type OutputKind = "pdf" | "zip" | "image" | "docx" | "xlsx" | "pptx";
export type InputKind = "pdf" | "image" | "word" | "excel" | "ppt" | "html";

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
  /** What kind of file this tool accepts as input. Defaults to "pdf". */
  inputKind?: InputKind;
  fields?: ToolField[];
  /** Only set for tools outside the translated 26 — not part of the `tools` messages namespace. */
  fallback?: { name: string; desc: string };
}

const ACCEPT_BY_INPUT_KIND: Record<InputKind, string> = {
  pdf: ".pdf,application/pdf",
  image: ".jpg,.jpeg,.png,image/jpeg,image/png",
  word: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  excel: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: ".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  html: ".html,.htm,text/html",
};

export function getAccept(config: ToolConfig): string {
  return ACCEPT_BY_INPUT_KIND[config.inputKind ?? "pdf"];
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
  { slug: "jpg-to-pdf", multi: true, outputKind: "pdf", technique: "pdf-lib", inputKind: "image" },
  { slug: "html-to-pdf", multi: false, outputKind: "pdf", technique: "office", inputKind: "html" },
  { slug: "word-to-pdf", multi: false, outputKind: "pdf", technique: "office", inputKind: "word" },
  { slug: "excel-to-pdf", multi: false, outputKind: "pdf", technique: "office", inputKind: "excel" },
  { slug: "ppt-to-pdf", multi: false, outputKind: "pdf", technique: "office", inputKind: "ppt" },
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

/** Picks `count` other tools to suggest next, in registry order, wrapping around. */
export function getRelatedTools(slug: string, count = 4): ToolConfig[] {
  const index = TOOL_REGISTRY.findIndex((t) => t.slug === slug);
  if (index === -1) return TOOL_REGISTRY.slice(0, count);
  const related: ToolConfig[] = [];
  for (let i = 1; related.length < count && i < TOOL_REGISTRY.length; i++) {
    related.push(TOOL_REGISTRY[(index + i) % TOOL_REGISTRY.length]);
  }
  return related;
}
