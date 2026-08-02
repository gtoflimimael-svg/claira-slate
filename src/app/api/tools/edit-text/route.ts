import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runEditText, type TextEdit, type TextAlignment } from "@/lib/tools/handlers/edit-text-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const ALIGNMENTS: TextAlignment[] = ["left", "center", "right"];

function parseEdit(raw: unknown): TextEdit | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const page = Number(r.page);
  if (!Number.isFinite(page) || page < 1) return null;
  if (typeof r.newText !== "string" || !r.newText.trim()) return null;

  return {
    page,
    x: Number(r.x) || 0,
    y: Number(r.y) || 0,
    width: Number.isFinite(r.width) ? (r.width as number) : undefined,
    height: Number.isFinite(r.height) ? (r.height as number) : undefined,
    newText: r.newText,
    fontSize: Number(r.fontSize) || 12,
    color: typeof r.color === "string" ? r.color : "#000000",
    bold: !!r.bold,
    italic: !!r.italic,
    alignment: ALIGNMENTS.includes(r.alignment as TextAlignment) ? (r.alignment as TextAlignment) : "left",
    isNew: !!r.isNew,
  };
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

  let edits: TextEdit[];
  try {
    const parsed = JSON.parse(configRaw);
    if (!Array.isArray(parsed.edits)) throw new Error("invalid");
    edits = parsed.edits.map(parseEdit).filter((e: TextEdit | null): e is TextEdit => e !== null);
  } catch {
    return NextResponse.json({ error: "Invalid edit configuration." }, { status: 400 });
  }

  if (edits.length === 0) {
    return NextResponse.json({ error: "Make at least one text edit before saving." }, { status: 400 });
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
  const filename = `${baseName}-edited.pdf`;

  let result;
  try {
    result = await runEditText(buffer, edits);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unsupported PDF format." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "edit-text", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    blocksEdited: result.blocksEdited,
    plan,
    loggedIn: !!user,
  });
}
