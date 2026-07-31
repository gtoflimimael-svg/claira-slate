export type { SourceFile } from "@/components/tools/organize/types";
export { SOURCE_COLORS, sourceLabelForIndex, genId } from "@/components/tools/organize/types";

export interface RotatePage {
  id: string;
  sourceId: string;
  originalIndex: number;
  rotation: number; // 0 | 90 | 180 | 270
}

export interface PageDims {
  width: number;
  height: number;
}

export function isRotated(page: RotatePage): boolean {
  return page.rotation !== 0;
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}
