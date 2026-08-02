import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runCrop, fromPoints, type CropConfig, type CropUnit, type CropPreset } from "@/lib/tools/handlers/crop-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const UNITS: CropUnit[] = ["mm", "px", "inches"];
const PRESETS: CropPreset[] = ["a4-portrait", "a4-landscape", "letter", "square", "custom"];

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

  let config: CropConfig;
  try {
    const parsed = JSON.parse(configRaw);
    const method = ["manual", "preset", "auto"].includes(parsed.method) ? parsed.method : "manual";
    const unit: CropUnit = UNITS.includes(parsed.margins?.unit) ? parsed.margins.unit : "mm";

    config = {
      method,
      margins:
        method === "manual"
          ? {
              top: Number(parsed.margins?.top) || 0,
              bottom: Number(parsed.margins?.bottom) || 0,
              left: Number(parsed.margins?.left) || 0,
              right: Number(parsed.margins?.right) || 0,
              unit,
            }
          : undefined,
      preset: PRESETS.includes(parsed.preset) ? parsed.preset : undefined,
      customSize:
        parsed.preset === "custom" && parsed.customSize
          ? {
              width: Number(parsed.customSize.width) || 0,
              height: Number(parsed.customSize.height) || 0,
              unit: UNITS.includes(parsed.customSize.unit) ? parsed.customSize.unit : "mm",
            }
          : undefined,
      applyTo: parsed.applyTo === "all" || parsed.applyTo === undefined ? "all" : Array.isArray(parsed.applyTo) ? parsed.applyTo.filter((n: unknown) => typeof n === "number") : "all",
      maintainAspectRatio: !!parsed.maintainAspectRatio,
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
  const filename = `${baseName}-cropped.pdf`;

  let result;
  try {
    result = await runCrop(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't crop this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "crop", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  const first = result.perPage[0];
  const displayUnit: CropUnit = "mm";

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesCropped,
    pagesCropped: result.pagesCropped,
    margins: first
      ? {
          top: fromPoints(first.marginsPt.top, displayUnit),
          bottom: fromPoints(first.marginsPt.bottom, displayUnit),
          left: fromPoints(first.marginsPt.left, displayUnit),
          right: fromPoints(first.marginsPt.right, displayUnit),
        }
      : null,
    newSize: first ? { width: fromPoints(first.newWidthPt, displayUnit), height: fromPoints(first.newHeightPt, displayUnit) } : null,
    plan,
    loggedIn: !!user,
  });
}
