import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runPdfToExcel, type ExcelConfig } from "@/lib/tools/handlers/excel-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

// Dedicated route — supersedes the generic dispatcher's "pdf-to-excel" entry,
// which was a coming-soon stub (see STUB_MESSAGE in dispatch.ts); this is a
// genuinely new implementation.
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

  let config: ExcelConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      mode: parsed.mode === "all-rows" ? "all-rows" : "auto",
      oneSheetPerPage: !!parsed.oneSheetPerPage,
      preserveBorders: !!parsed.preserveBorders,
      autoFormat: !!parsed.autoFormat,
      includeImages: !!parsed.includeImages,
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
  const filename = `${baseName}.xlsx`;

  let result;
  try {
    result = await runPdfToExcel(buffer, config);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't convert this PDF to Excel." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  if (user) await logToolUsage(user.id, "pdf-to-excel", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pagesScanned,
    tablesFound: result.tablesFound,
    pagesScanned: result.pagesScanned,
    rowsExtracted: result.rowsExtracted,
    imagesEmbedded: result.imagesEmbedded,
    plan,
    loggedIn: !!user,
  });
}
