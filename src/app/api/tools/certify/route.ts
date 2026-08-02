import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runCertify, checkCompliance, type PdfAStandard } from "@/lib/tools/handlers/certify-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const STANDARDS: PdfAStandard[] = ["pdfa1b", "pdfa2b", "pdfa3b"];

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

  let standard: PdfAStandard;
  try {
    const parsed = JSON.parse(configRaw);
    standard = STANDARDS.includes(parsed.standard) ? parsed.standard : "pdfa1b";
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
  const filename = `${baseName}-${standard}.pdf`;

  let result;
  try {
    result = await runCertify(buffer, standard);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't certify this PDF." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "certify", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: null,
    standard,
    fullyCompliant: result.fullyCompliant,
    compliance: result.compliance,
    plan,
    loggedIn: !!user,
  });
}

export async function PUT(request: NextRequest) {
  // Pre-check endpoint: inspect a PDF's compliance before running the real
  // conversion, so the UI can show "will be removed/flattened" up front.
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const compliance = await checkCompliance(buffer);
    return NextResponse.json({ compliance });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't inspect this PDF." }, { status: 400 });
  }
}
