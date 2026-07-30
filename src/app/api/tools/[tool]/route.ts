import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { getToolConfig } from "@/lib/tools/registry";
import { runTool } from "@/lib/tools/dispatch";
import { isComingSoon } from "@/lib/tools/types";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

export async function POST(request: NextRequest, context: RouteContext<"/api/tools/[tool]">) {
  const { tool } = await context.params;
  const config = getToolConfig(tool);
  if (!config) {
    return NextResponse.json({ error: `Unknown tool "${tool}".` }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileEntries = formData.getAll("file").filter((f): f is File => f instanceof File);
  if (fileEntries.length === 0 || (!config.multi && fileEntries.length > 1)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  const quota = await enforceTaskQuota(user.id);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  for (const file of fileEntries) {
    const sizeCheck = checkFileSize({ size: file.size }, quota.plan);
    if (!sizeCheck.allowed) {
      return NextResponse.json(
        { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
        { status: 413 }
      );
    }
  }

  const files = await Promise.all(fileEntries.map(async (f) => Buffer.from(await f.arrayBuffer())));
  const filenames = fileEntries.map((f) => f.name);
  const params: Record<string, string> = {};
  for (const field of config.fields ?? []) {
    const value = formData.get(field.name);
    if (typeof value === "string") params[field.name] = value;
  }

  const result = await runTool(tool, { files, filenames, params });

  if (isComingSoon(result)) {
    return NextResponse.json({ comingSoon: true, message: result.message, plan: quota.plan });
  }

  const r2Key = `processed/${user.id}/${crypto.randomUUID()}-${result.filename}`;
  await uploadToR2(r2Key, result.buffer, result.mimeType);
  await logToolUsage(user.id, tool, result.filename, result.buffer.byteLength, r2Key);
  const downloadUrl = await getSignedDownloadUrl(r2Key, result.filename, 3600);

  return NextResponse.json({
    downloadUrl,
    filename: result.filename,
    r2Key,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    plan: quota.plan,
  });
}
