import dns from "node:dns/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { convertWithLibreOffice } from "@/lib/tools/libreoffice";

export type HtmlToPdfPageSize = "a4-portrait" | "a4-landscape" | "letter-portrait" | "match-content";
export type HtmlToPdfMargin = "none" | "minimal" | "standard" | "wide";

export interface HtmlToPdfConfig {
  type: "url" | "html";
  content: string;
  pageSize: HtmlToPdfPageSize;
  includeBackground: boolean;
  waitTime: number;
  margin: HtmlToPdfMargin;
  removeHeaderFooter: boolean;
  addUrlFooter: boolean;
}

export interface HtmlToPdfResult {
  buffer: Buffer;
  pagesCreated: number;
}

const MARGIN_MM: Record<HtmlToPdfMargin, number> = { none: 0, minimal: 8, standard: 18, wide: 32 };

const PAGE_CSS: Record<HtmlToPdfPageSize, string> = {
  "a4-portrait": "size: A4 portrait;",
  "a4-landscape": "size: A4 landscape;",
  "letter-portrait": "size: Letter portrait;",
  "match-content": "size: 1000px 1400px;",
};

function ipInCidr(ip: number[], base: number[], prefix: number): boolean {
  const fullBytes = Math.floor(prefix / 8);
  const remBits = prefix % 8;
  for (let i = 0; i < fullBytes; i++) if (ip[i] !== base[i]) return false;
  if (remBits === 0) return true;
  const mask = 0xff << (8 - remBits);
  return (ip[fullBytes] & mask) === (base[fullBytes] & mask);
}

const PRIVATE_V4_RANGES: [number[], number][] = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[224, 0, 0, 0], 4],
];

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  return PRIVATE_V4_RANGES.some(([base, prefix]) => ipInCidr(parts, base, prefix));
}

function isPrivateIpv6(address: string): boolean {
  const a = address.toLowerCase();
  if (a === "::1" || a === "::") return true;
  if (a.startsWith("::ffff:")) return isPrivateIpv4(a.slice(7));
  if (a.startsWith("fe80:") || a.startsWith("fc") || a.startsWith("fd")) return true; // link-local + unique-local
  return false;
}

/**
 * Resolves a URL's hostname and rejects it if it (or any redirect target)
 * points at a private/loopback/link-local address — a bare server-side
 * `fetch(userUrl)` on an arbitrary user-supplied URL is a classic SSRF
 * vector (e.g. reaching cloud metadata endpoints or internal services).
 */
async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http:// and https:// URLs are supported.");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    throw new Error("This URL points at a non-public address and can't be converted.");
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error("Couldn't resolve that URL's domain.");
  }
  for (const { address, family } of addresses) {
    const isPrivate = family === 4 ? isPrivateIpv4(address) : isPrivateIpv6(address);
    if (isPrivate) throw new Error("This URL points at a non-public address and can't be converted.");
  }
}

async function fetchPublicUrl(rawUrl: string): Promise<string> {
  let current = new URL(rawUrl);
  for (let redirects = 0; redirects < 5; redirects++) {
    await assertPublicUrl(current);
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ClairaSlateBot/1.0; +https://claira-slate.vercel.app)" },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("The page redirected without a destination.");
      current = new URL(location, current);
      continue;
    }
    if (!res.ok) throw new Error(`The page responded with status ${res.status}.`);
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > 15_000_000) throw new Error("That page is too large to convert.");
    return await res.text();
  }
  throw new Error("Too many redirects.");
}

function injectPageStyles(html: string, config: HtmlToPdfConfig, sourceUrl: string | null): string {
  const marginMm = MARGIN_MM[config.margin];
  const rules = [`@page { ${PAGE_CSS[config.pageSize]} margin: ${marginMm}mm; }`];
  if (!config.includeBackground) {
    rules.push("* { background: none !important; background-color: transparent !important; background-image: none !important; box-shadow: none !important; }");
  } else {
    rules.push("* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }");
  }
  if (config.removeHeaderFooter) {
    rules.push("header, footer, nav { display: none !important; }");
  }
  const style = `<style>${rules.join("\n")}</style>`;

  let out = html;
  if (config.removeHeaderFooter) {
    out = out.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, "");
    out = out.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, "");
    out = out.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, "");
  }

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${style}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${style}</head>`);
  } else {
    out = `<html><head>${style}</head><body>${out}</body></html>`;
  }
  void sourceUrl;
  return out;
}

function drawUrlFooter(pdfBuffer: Buffer, url: string): Promise<Buffer> {
  return (async () => {
    const doc = await PDFDocument.load(pdfBuffer);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const label = url.length > 100 ? `${url.slice(0, 97)}...` : url;
    for (const page of doc.getPages()) {
      const { width } = page.getSize();
      const size = 8;
      const textWidth = font.widthOfTextAtSize(label, size);
      page.drawText(label, { x: Math.max(12, (width - textWidth) / 2), y: 10, size, font, color: rgb(0.45, 0.45, 0.45) });
    }
    return Buffer.from(await doc.save());
  })();
}

export async function runHtmlToPdf(config: HtmlToPdfConfig): Promise<HtmlToPdfResult> {
  let rawHtml: string;
  let sourceUrl: string | null = null;

  if (config.type === "url") {
    sourceUrl = config.content.trim();
    if (!/^https?:\/\//i.test(sourceUrl)) sourceUrl = `https://${sourceUrl}`;
    rawHtml = await fetchPublicUrl(sourceUrl);
    if (config.waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(config.waitTime, 10_000)));
    }
  } else {
    rawHtml = config.content;
  }

  const preparedHtml = injectPageStyles(rawHtml, config, sourceUrl);

  let pdfBuffer = await convertWithLibreOffice(Buffer.from(preparedHtml, "utf-8"), "html", "pdf");
  if (!pdfBuffer) {
    throw new Error("PDF conversion isn't available on this server right now.");
  }

  if (config.addUrlFooter && sourceUrl) {
    pdfBuffer = await drawUrlFooter(pdfBuffer, sourceUrl);
  }

  const doc = await PDFDocument.load(pdfBuffer);
  return { buffer: pdfBuffer, pagesCreated: doc.getPageCount() };
}
