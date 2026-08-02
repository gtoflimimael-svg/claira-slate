import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runHeaderFooter, type HeaderFooterConfig, type HeaderFooterSection, type HeaderFooterApplyTo } from "@/lib/tools/handlers/header-footer-logic";
import type { FontFamily } from "@/lib/tools/handlers/pdf-text-style";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const FONT_FAMILIES: FontFamily[] = ["helvetica", "times", "courier", "helvetica-oblique"];

function parseSection(raw: unknown, defaultMargin: number): HeaderFooterSection {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    left: typeof r.left === "string" ? r.left : undefined,
    center: typeof r.center === "string" ? r.center : undefined,
    right: typeof r.right === "string" ? r.right : undefined,
    fontSize: Number(r.fontSize) || 10,
    fontFamily: FONT_FAMILIES.includes(r.fontFamily as FontFamily) ? (r.fontFamily as FontFamily) : "helvetica",
    color: typeof r.color === "string" ? r.color : "#444444",
    bold: !!r.bold,
    italic: !!r.italic,
    showLine: !!r.showLine,
    margin: Number.isFinite(r.margin) ? (r.margin as number) : defaultMargin,
  };
}

function parseApplyTo(raw: unknown): HeaderFooterApplyTo {
  if (raw === "skip-first" || raw === "odd" || raw === "even") return raw;
  if (Array.isArray(raw)) return raw.filter((n) => typeof n === "number");
  return "all";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const configRaw = formData.get("config");
  if (!(file instanceof File) || typeof configRaw !== "string") {
    return NextResponse.json({ error: "Missing 'file' or 'config' in form data." }, { status: 400 });
  }

  let config: HeaderFooterConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      header: parseSection(parsed.header, 20),
      footer: parseSection(parsed.footer, 20),
      applyTo: parseApplyTo(parsed.applyTo),
      lineColor: typeof parsed.lineColor === "string" ? parsed.lineColor : "#cccccc",
      lineThickness: Number(parsed.lineThickness) || 0.5,
    };
  } catch {
    return NextResponse.json({ error: "Invalid conversion configuration." }, { status: 400 });
  }

  if (!config.header.left && !config.header.center && !config.header.right && !config.footer.left && !config.footer.center && !config.footer.right) {
    return NextResponse.json({ error: "Add at least one header or footer field." }, { status: 400 });
  }

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
    }
    plan = quota.plan;
  }

  const sizeCheck = checkFileSize({ size: file.size }, plan);
  if (!sizeCheck.allowed) {
    return NextResponse.json(
      { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const filename = `${baseName}-header-footer.pdf`;

  let result;
  try {
    result = await runHeaderFooter(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't add a header/footer to this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "header-footer", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesUpdated,
    pagesUpdated: result.pagesUpdated,
    plan,
    loggedIn: !!user,
  });
}
