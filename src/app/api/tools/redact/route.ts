import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runRedact, type RedactConfig } from "@/lib/tools/handlers/redact-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

function isValidBox(b: unknown): b is { page: number; x: number; y: number; width: number; height: number; color?: string } {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  return typeof r.page === "number" && typeof r.x === "number" && typeof r.y === "number" && typeof r.width === "number" && typeof r.height === "number";
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

  let config: RedactConfig;
  try {
    const parsed = JSON.parse(configRaw);
    const redactions = Array.isArray(parsed.redactions) ? parsed.redactions.filter(isValidBox) : [];
    config = {
      redactions: redactions.map((b: { page: number; x: number; y: number; width: number; height: number; color?: string }) => ({
        page: b.page,
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        color: typeof b.color === "string" ? b.color : "#000000",
      })),
      removeUnderlyingText: parsed.removeUnderlyingText !== false,
      removeMetadata: !!parsed.removeMetadata,
      aiRedact: parsed.aiRedact
        ? {
            emails: !!parsed.aiRedact.emails,
            phones: !!parsed.aiRedact.phones,
            names: !!parsed.aiRedact.names,
            dates: !!parsed.aiRedact.dates,
            creditCards: !!parsed.aiRedact.creditCards,
            ssn: !!parsed.aiRedact.ssn,
            customPattern: typeof parsed.aiRedact.customPattern === "string" ? parsed.aiRedact.customPattern : undefined,
          }
        : undefined,
    };
  } catch {
    return NextResponse.json({ error: "Invalid conversion configuration." }, { status: 400 });
  }

  if (config.redactions.length === 0 && !config.aiRedact) {
    return NextResponse.json({ error: "Draw at least one redaction box, or enable AI auto-redact." }, { status: 400 });
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
  const filename = `${baseName}-redacted.pdf`;

  let result;
  try {
    result = await runRedact(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't redact this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "redact", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pageCount,
    redactionCount: result.redactionCount,
    plan,
    loggedIn: !!user,
  });
}
