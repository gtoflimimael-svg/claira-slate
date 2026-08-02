import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runWatermark, type WatermarkConfig } from "@/lib/tools/handlers/watermark-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const POSITIONS = ["TL", "TC", "TR", "ML", "MC", "MR", "BL", "BC", "BR"];
const FONT_FAMILIES = ["helvetica", "times", "courier", "helvetica-oblique"];

function parseApplyTo(raw: unknown): WatermarkConfig["applyTo"] {
  if (raw === "first") return "first";
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
  const watermarkImage = formData.get("watermarkImage");
  const configRaw = formData.get("config");
  if (!(file instanceof File) || typeof configRaw !== "string") {
    return NextResponse.json({ error: "Missing 'file' or 'config' in form data." }, { status: 400 });
  }

  let config: WatermarkConfig;
  try {
    const parsed = JSON.parse(configRaw);
    const type = parsed.type === "image" ? "image" : "text";

    if (type === "image" && !(watermarkImage instanceof File)) {
      return NextResponse.json({ error: "A watermark image is required." }, { status: 400 });
    }

    config = {
      type,
      text:
        type === "text"
          ? {
              content: typeof parsed.text?.content === "string" && parsed.text.content ? parsed.text.content : "CONFIDENTIAL",
              fontSize: Number(parsed.text?.fontSize) || 48,
              fontFamily: FONT_FAMILIES.includes(parsed.text?.fontFamily) ? parsed.text.fontFamily : "helvetica",
              color: typeof parsed.text?.color === "string" ? parsed.text.color : "#999999",
              opacity: typeof parsed.text?.opacity === "number" ? parsed.text.opacity : 0.35,
              bold: !!parsed.text?.bold,
              italic: !!parsed.text?.italic,
            }
          : undefined,
      imageBuffer: watermarkImage instanceof File ? Buffer.from(await watermarkImage.arrayBuffer()) : undefined,
      imageOpacity: typeof parsed.imageOpacity === "number" ? parsed.imageOpacity : 0.5,
      position: POSITIONS.includes(parsed.position) ? parsed.position : "MC",
      diagonal: !!parsed.diagonal,
      applyTo: parseApplyTo(parsed.applyTo),
      scale: typeof parsed.scale === "number" ? parsed.scale : 1,
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
  const filename = `${baseName}-watermarked.pdf`;

  let result;
  try {
    result = await runWatermark(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't watermark this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "watermark", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesStamped,
    pagesStamped: result.pagesStamped,
    plan,
    loggedIn: !!user,
  });
}
