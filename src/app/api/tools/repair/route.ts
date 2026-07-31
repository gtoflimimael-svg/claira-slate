import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runRepair } from "@/lib/tools/handlers/repair-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route (bypasses the generic /api/tools/[tool] dispatcher, same
// as every other rebuilt tool) — repair has no configuration, and needs to
// report recovered/total page counts the generic dispatcher's response
// shape doesn't carry.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
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
  const filename = `${baseName}-repaired.pdf`;

  // runRepair never throws — it always returns a best-effort buffer.
  const repairResult = await runRepair(buffer);

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, repairResult.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "repair", filename, repairResult.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  let pages: number | null = repairResult.pagesRecovered;
  try {
    pages = (await PDFDocument.load(repairResult.buffer, { ignoreEncryption: true })).getPageCount();
  } catch {
    // Keep the count runRepair already computed.
  }

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: repairResult.buffer.byteLength,
    pages,
    pagesRecovered: repairResult.pagesRecovered,
    pagesTotal: repairResult.pagesTotal,
    fullyRecovered: repairResult.fullyRecovered,
    plan,
    loggedIn: !!user,
  });
}
