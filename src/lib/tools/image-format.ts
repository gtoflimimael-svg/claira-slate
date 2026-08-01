/** Sniffs an image's real encoded format from its file signature — used when
 *  a source (like pdf-parse's getImage()) hands back re-encoded image bytes
 *  without stating which container it used. */
export function sniffImageType(data: Uint8Array): "png" | "jpg" | "gif" | "bmp" | null {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return "png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return "gif";
  if (data[0] === 0x42 && data[1] === 0x4d) return "bmp";
  return null;
}
