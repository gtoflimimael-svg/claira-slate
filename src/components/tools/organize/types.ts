export interface SourceFile {
  id: string;
  file: File;
  color: string;
  label: string; // "A", "B", "C", ...
  pageCount: number | null;
}

export interface OrganizePage {
  id: string;
  sourceId: string;
  originalIndex: number; // 0-based page index within its source PDF
  rotation: number; // 0 | 90 | 180 | 270, additive to the page's existing rotation
  duplicatedFrom?: string; // page id this was duplicated from
  moved?: boolean; // true once its position differs from where it was first placed
}

export const SOURCE_COLORS = ["#6C63FF", "#06B6D4", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6"];

/** A, B, ... Z, AA, AB, ... — cycles like spreadsheet columns for 27+ sources. */
export function sourceLabelForIndex(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

export function genId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}${Date.now()}-${Math.random()}`;
}

/** Marks pages whose index changed between two orderings — used after any drag/sort commit. */
export function markMoved(oldPages: OrganizePage[], newPages: OrganizePage[]): OrganizePage[] {
  const oldIndex = new Map(oldPages.map((p, i) => [p.id, i]));
  return newPages.map((p, i) => (oldIndex.get(p.id) !== i ? { ...p, moved: true } : p));
}

export function isModified(page: OrganizePage): boolean {
  return !!page.moved || page.rotation !== 0 || !!page.duplicatedFrom;
}
