import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkFileSize } from "@/lib/quota";
import { enforceTaskQuota, logToolUsage } from "@/lib/tools/quota";
import { runAdvancedOcr, buildSearchablePdf, buildTextVisiblePdf, type OcrConfig, type OcrQuality, type OcrOutputMode } from "@/lib/tools/handlers/ocr-logic";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage/r2";

const QUALITIES: OcrQuality[] = ["fast", "balanced", "precise"];

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}

// Streams newline-delimited JSON progress events ({type:"progress"}) followed
// by a single {type:"done"|"error"} event — real per-page progress for OCR,
// which can take a while, rather than a fake client-side progress animation.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const configRaw = formData.get("config");
  if (!(file instanceof File) || typeof configRaw !== "string") {
    return jsonError("Missing 'file' or 'config' in form data.", 400);
  }

  let config: OcrConfig;
  try {
    const parsed = JSON.parse(configRaw);
    config = {
      languages: Array.isArray(parsed.languages) ? parsed.languages.filter((l: unknown) => typeof l === "string") : [],
      quality: QUALITIES.includes(parsed.quality) ? parsed.quality : "balanced",
      outputMode: (parsed.outputMode === "text-visible" ? "text-visible" : "searchable") as OcrOutputMode,
      correctSkew: !!parsed.correctSkew,
      removeNoise: !!parsed.removeNoise,
      detectTables: !!parsed.detectTables,
      generateTextFile: !!parsed.generateTextFile,
    };
  } catch {
    return jsonError("Invalid OCR configuration.", 400);
  }

  let plan: "free" | "pro" | "business" = "free";
  if (user) {
    const quota = await enforceTaskQuota(user.id);
    if (!quota.ok) return jsonError(quota.error, quota.status, { limit: quota.limit, plan: quota.plan });
    plan = quota.plan;
  }

  if (config.quality === "precise" && plan === "free") {
    return jsonError("Precise OCR quality is a Pro feature. Upgrade to unlock it.", 403, { plan });
  }

  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    return jsonError("Unsupported PDF format.", 400);
  }

  const sizeCheck = checkFileSize({ size: file.size }, plan);
  if (!sizeCheck.allowed) {
    return jsonError(`File too large for OCR — try compressing first (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).`, 413);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const baseName = file.name.replace(/\.pdf$/i, "") || "document";
  const owner = user ? user.id : "anonymous";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        const result = await runAdvancedOcr(buffer, config, (page, total) => send({ type: "progress", page, total }));

        if (result.pages.every((p) => p.lines.length === 0)) {
          send({ type: "error", error: "No text found on this page." });
          controller.close();
          return;
        }

        const outBytes = config.outputMode === "text-visible" ? await buildTextVisiblePdf(result.pages) : await buildSearchablePdf(result.pages);
        const filename = `${baseName}-ocr.pdf`;
        const r2Key = `processed/${owner}/${crypto.randomUUID()}-${filename}`;
        await uploadToR2(r2Key, Buffer.from(outBytes), "application/pdf");
        if (user) await logToolUsage(user.id, "ocr", filename, outBytes.byteLength, r2Key);
        const downloadUrl = await getSignedDownloadUrl(r2Key, filename, 3600);

        let textDownloadUrl: string | undefined;
        let textFilename: string | undefined;
        if (config.generateTextFile) {
          textFilename = `${baseName}-ocr.txt`;
          const textR2Key = `processed/${owner}/${crypto.randomUUID()}-${textFilename}`;
          await uploadToR2(textR2Key, Buffer.from(result.fullText, "utf-8"), "text/plain");
          textDownloadUrl = await getSignedDownloadUrl(textR2Key, textFilename, 3600);
        }

        send({
          type: "done",
          downloadUrl,
          filename,
          r2Key,
          size: outBytes.byteLength,
          pages: result.pages.length,
          averageConfidence: result.averageConfidence,
          languagesUsed: result.languagesUsed,
          textDownloadUrl,
          textFilename,
          plan,
          loggedIn: !!user,
        });
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : "Couldn't OCR this PDF." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
