import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, checkFileSize } from "@/lib/quota";
import { extractTextFromPDF } from "@/lib/ai/extract-text";

// Extracts text once so the client can hold it in state and reuse it across
// multiple chat questions or a translation, instead of re-uploading and
// re-parsing the PDF on every request. No LLM call happens here, so it isn't
// gated by the monthly AI-action quota — only by the plan's file-size limit.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' in form data." }, { status: 400 });
  }

  const plan = await getUserPlan(user.id);
  const sizeCheck = checkFileSize({ size: file.size }, plan);
  if (!sizeCheck.allowed) {
    return NextResponse.json(
      { error: `File too large for your plan (max ${(sizeCheck.limit / (1024 * 1024)).toFixed(0)} MB).` },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractTextFromPDF(buffer);

  if (extracted.isScanned) {
    return NextResponse.json(
      { error: "No extractable text found — this looks like a scanned PDF. Try the OCR tool first." },
      { status: 422 }
    );
  }

  return NextResponse.json(extracted);
}
