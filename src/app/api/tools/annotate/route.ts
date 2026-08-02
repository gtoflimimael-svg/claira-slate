import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runAnnotate, type AnnotationInput, type AnnotationType } from "@/lib/tools/handlers/annotate-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const TYPES: AnnotationType[] = ["highlight", "underline", "strikethrough", "comment", "textbox", "draw", "arrow", "rectangle", "ellipse"];

function parseAnnotation(raw: unknown): AnnotationInput | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (!TYPES.includes(r.type as AnnotationType)) return null;
  const page = Number(r.page);
  if (!Number.isFinite(page) || page < 1) return null;

  return {
    type: r.type as AnnotationType,
    page,
    color: typeof r.color === "string" ? r.color : "#ffff00",
    opacity: Number.isFinite(r.opacity) ? Math.max(0, Math.min(1, r.opacity as number)) : 1,
    text: typeof r.text === "string" ? r.text : undefined,
    thickness: Number.isFinite(r.thickness) ? (r.thickness as number) : undefined,
    fontSize: Number.isFinite(r.fontSize) ? (r.fontSize as number) : undefined,
    quads: Array.isArray(r.quads) ? (r.quads as number[][]) : undefined,
    rect: Array.isArray(r.rect) && r.rect.length === 4 ? (r.rect as [number, number, number, number]) : undefined,
    line: Array.isArray(r.line) && r.line.length === 4 ? (r.line as [number, number, number, number]) : undefined,
    points: Array.isArray(r.points) ? (r.points as number[][][]) : undefined,
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

  let annotations: AnnotationInput[];
  try {
    const parsed = JSON.parse(configRaw);
    if (!Array.isArray(parsed.annotations)) throw new Error("invalid");
    annotations = parsed.annotations.map(parseAnnotation).filter((a: AnnotationInput | null): a is AnnotationInput => a !== null);
  } catch {
    return NextResponse.json({ error: "Invalid annotation configuration." }, { status: 400 });
  }

  if (annotations.length === 0) {
    return NextResponse.json({ error: "Add at least one annotation before saving." }, { status: 400 });
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
  const filename = `${baseName}-annotated.pdf`;

  let result;
  try {
    result = await runAnnotate(buffer, annotations);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unsupported PDF format." }, { status: 400 });
  }

  const owner = user ? user.id : "anonymous";
  const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
  await uploadToR2(r2Key, result.buffer, "application/pdf");
  if (user) await logToolUsage(user.id, "annotate", filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename,
    r2Key,
    size: result.buffer.byteLength,
    pages: result.pageCount,
    annotationCount: result.annotationCount,
    plan,
    loggedIn: !!user,
  });
}
