import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runProtect, type ProtectConfig } from "@/lib/tools/handlers/protect-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

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

  let config: ProtectConfig;
  try {
    const parsed = JSON.parse(configRaw);
    if (typeof parsed.openPassword !== "string" || parsed.openPassword.length === 0) {
      return NextResponse.json({ error: "An open password is required." }, { status: 400 });
    }
    config = {
      openPassword: parsed.openPassword,
      permissionsPassword: typeof parsed.permissionsPassword === "string" && parsed.permissionsPassword.length > 0 ? parsed.permissionsPassword : null,
      permissions: {
        print: parsed.permissions?.print !== false,
        copy: parsed.permissions?.copy !== false,
        edit: !!parsed.permissions?.edit,
        annotate: !!parsed.permissions?.annotate,
        fillForms: !!parsed.permissions?.fillForms,
      },
      encryption: parsed.encryption === "aes256" ? "aes256" : "aes128",
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
  const filename = `${baseName}-protected.pdf`;

  let result;
  try {
    result = await runProtect(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't protect this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "protect", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: null,
    encryption: config.encryption,
    plan,
    loggedIn: !!user,
  });
}
