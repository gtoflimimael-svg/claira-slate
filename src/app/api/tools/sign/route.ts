import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runSign, type SignConfig } from "@/lib/tools/handlers/sign-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

function parsePagePlacement(raw: unknown): SignConfig["placement"]["page"] {
  if (raw === "all") return "all";
  if (Array.isArray(raw)) return raw.filter((n) => typeof n === "number");
  if (typeof raw === "number") return raw;
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

  let config: SignConfig;
  try {
    const parsed = JSON.parse(configRaw);
    if (typeof parsed.signatureData !== "string" || !parsed.signatureData) {
      return NextResponse.json({ error: "A signature is required." }, { status: 400 });
    }
    config = {
      signatureData: parsed.signatureData,
      placement: {
        page: parsePagePlacement(parsed.placement?.page),
        x: Number(parsed.placement?.x) || 0,
        y: Number(parsed.placement?.y) || 0,
        width: Number(parsed.placement?.width) || 150,
        height: Number(parsed.placement?.height) || 60,
        opacity: typeof parsed.placement?.opacity === "number" ? parsed.placement.opacity : 1,
      },
      addDateStamp: !!parsed.addDateStamp,
      dateFormat: typeof parsed.dateFormat === "string" ? parsed.dateFormat : "DD/MM/YYYY",
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
  const filename = `${baseName}-signed.pdf`;

  let result;
  try {
    result = await runSign(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't sign this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "sign", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesSigned,
    pagesSigned: result.pagesSigned,
    plan,
    loggedIn: !!user,
  });
}
