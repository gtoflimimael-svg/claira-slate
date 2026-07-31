import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveAIQuota, applyAnonQuotaCookie, logAIUsage } from "@/lib/ai/quota-check";
import { generateWithGemini } from "@/lib/ai/gemini";
import { chatWithClaude, type ChatTurn } from "@/lib/ai/claude";
import { pickProvider } from "@/lib/ai/model-router";

const MAX_CHARS = 40_000;

const SYSTEM_PROMPT =
  "You are a document assistant. Answer questions based ONLY on the provided document. Always cite the relevant section or page number. If the answer is not in the document, say so clearly.\n\n" +
  "Respond in exactly this format, with no other text:\n" +
  "ANSWER: <your answer>\n" +
  "CITATIONS: <comma-separated page/section references, or NONE>";

function parseResponse(text: string): { answer: string; citations: string[] } {
  const answerMatch = text.match(/ANSWER:\s*([\s\S]*?)(?:\nCITATIONS:|$)/i);
  const citationsMatch = text.match(/CITATIONS:\s*(.*)/i);

  const answer = (answerMatch?.[1] ?? text).trim();
  const rawCitations = citationsMatch?.[1]?.trim() ?? "";
  const citations =
    !rawCitations || /^none$/i.test(rawCitations)
      ? []
      : rawCitations.split(",").map((c) => c.trim()).filter(Boolean);

  return { answer, citations };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const body = await request.json().catch(() => null);
  const question: string | undefined = body?.question;
  const pdfText: string | undefined = body?.pdfText;
  const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

  if (!question || !pdfText) {
    return NextResponse.json({ error: "Missing 'question' or 'pdfText'." }, { status: 400 });
  }

  const quota = await resolveAIQuota(request, user?.id ?? null);
  if (!quota.ok) {
    return NextResponse.json({ error: quota.error, limit: quota.limit, plan: quota.plan }, { status: quota.status });
  }

  const provider = pickProvider("chat", quota.plan);
  const documentTurn: ChatTurn = { role: "user", content: `Document:\n${pdfText.slice(0, MAX_CHARS)}` };
  const turns: ChatTurn[] = [documentTurn, ...history, { role: "user", content: question }];

  const result =
    provider === "claude"
      ? await chatWithClaude(SYSTEM_PROMPT, turns)
      : await generateWithGemini(
          `${SYSTEM_PROMPT}\n\n${turns.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n\n")}`
        );

  if (quota.userId) await logAIUsage(quota.userId, "chat", result.tokensUsed);

  const { answer, citations } = parseResponse(result.text);
  const response = NextResponse.json({ answer, citations, plan: quota.plan, loggedIn: !!quota.userId, tokensUsed: result.tokensUsed });
  if (quota.anonState) applyAnonQuotaCookie(response, quota.anonState);
  return response;
}
