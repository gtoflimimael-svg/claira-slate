export interface ToolInput {
  files: Buffer[];
  filenames: string[];
  params: Record<string, string>;
}

export interface ToolOutput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

export interface ToolComingSoon {
  comingSoon: true;
  message: string;
}

export type ToolResult = ToolOutput | ToolComingSoon;

export function isComingSoon(result: ToolResult): result is ToolComingSoon {
  return "comingSoon" in result;
}
