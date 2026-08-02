import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runNumberPages, type NumberPagesConfig, type NumberFormat } from "@/lib/tools/handlers/number-pages-logic";
import type { Position, FontFamily } from "@/lib/tools/handlers/pdf-text-style";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const POSITIONS: Position[] = ["TL", "TC", "TR", "ML", "MC", "MR", "BL", "BC", "BR"];
const FORMATS: NumberFormat[] = ["numeric", "with-total", "roman", "alpha", "custom"];
const FONT_FAMILIES: FontFamily[] = ["helvetica", "times", "courier", "helvetica-oblique"];

function parseApplyTo(raw: unknown): "all" | "skip-first" | number[] {
  if (raw === "skip-first") return "skip-first";
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

  let config: NumberPagesConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      position: POSITIONS.includes(parsed.position) ? parsed.position : "BC",
      format: FORMATS.includes(parsed.format) ? parsed.format : "numeric",
      customPrefix: typeof parsed.customPrefix === "string" ? parsed.customPrefix : undefined,
      startFrom: Number.isFinite(parsed.startFrom) ? Math.max(0, Math.floor(parsed.startFrom)) : 1,
      applyTo: parseApplyTo(parsed.applyTo),
      style: {
        fontSize: Number(parsed.style?.fontSize) || 12,
        fontFamily: FONT_FAMILIES.includes(parsed.style?.fontFamily) ? parsed.style.fontFamily : "helvetica",
        color: typeof parsed.style?.color === "string" ? parsed.style.color : "#111111",
        bold: !!parsed.style?.bold,
        italic: !!parsed.style?.italic,
      },
      margin: Number.isFinite(parsed.margin) ? parsed.margin : 20,
    };
  } catch {
    return NextResponse.json({ error: "Invalid conversion configuration." }, { status: 400 });
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
  const filename = `${baseName}-numbered.pdf`;

  let result;
  try {
    result = await runNumberPages(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't number the pages of this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "number-pages", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesNumbered,
    pagesNumbered: result.pagesNumbered,
    plan,
    loggedIn: !!user,
  });
}
