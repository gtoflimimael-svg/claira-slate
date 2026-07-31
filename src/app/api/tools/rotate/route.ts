import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runOrganize, type OrganizePageSpec } from "@/lib/tools/handlers/organize-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

interface RotateSpec {
  fileIndex: number;
  pageIndex: number;
  angle: number;
}

// The upgraded Rotate tool combines every uploaded PDF's pages (in upload
// order, each file's own page order — there's no reordering UI here) into
// one output PDF with per-page rotation applied. That's exactly what
// runOrganize() already does when given a pageOrder with no reordering, so
// this route reuses it rather than duplicating the page-copy/rotate logic —
// it does NOT touch dispatch.ts, /api/tools/organize, or any other tool.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const fileEntries = formData.getAll("file").filter((f): f is File => f instanceof File);
  const configRaw = formData.get("config");
  if (fileEntries.length === 0 || typeof configRaw !== "string") {
    return NextResponse.json({ error: "Missing 'file' or 'config' in form data." }, { status: 400 });
  }

  let rotations: RotateSpec[];
  try {
    const parsed = JSON.parse(configRaw);
    rotations = Array.isArray(parsed.rotations) ? parsed.rotations : [];
  } catch {
    return NextResponse.json({ error: "Invalid rotate configuration." }, { status: 400 });
  }
  if (rotations.length === 0) {
    return NextResponse.json({ error: "No pages to rotate." }, { status: 400 });
  }

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
    }
    plan = quota.plan;
  }

  for (const file of fileEntries) {
    const sizeCheck = checkFileSize({ size: file.size }, plan);
    if (!sizeCheck.allowed) {
      return NextResponse.json(
        { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
        { status: 413 }
      );
    }
  }

  const buffers = await Promise.all(fileEntries.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const baseName = (fileEntries.length === 1 ? fileEntries[0].name : "rotated").replace(/\.pdf$/i, "") || "rotated";

  const pageOrder: OrganizePageSpec[] = rotations.map((r) => ({
    fileIndex: r.fileIndex,
    pageIndex: r.pageIndex,
    rotation: r.angle,
  }));

  let result;
  try {
    result = await runOrganize(buffers, { pageOrder });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Couldn't rotate these PDFs." }, { status: 400 });
  }

  const filename = `${baseName}.pdf`;
  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "rotate", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  let pages: number | null = result.pages;
  try {
    pages = (await PDFDocument.load(result.buffer, { ignoreEncryption: true })).getPageCount();
  } catch {
    // Keep the count runOrganize already computed.
  }

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages,
    plan,
    loggedIn: !!user,
  });
}
