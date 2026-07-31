import type { Plan } from "@/lib/quota";

export type AIFeature = "summarize" | "chat" | "translate" | "ocr" | "organize-suggest" | "extract-suggest" | "delete-suggest";
export type AIProvider = "gemini" | "claude";

// Free plan is Gemini Flash-Lite only, across every feature. Pro/Business get
// Claude Haiku for the two premium features (Q&A, translation); summarize and
// OCR stay on Gemini for every plan.
export function pickProvider(feature: AIFeature, plan: Plan): AIProvider {
  if (feature === "summarize" || feature === "ocr") return "gemini";
  return plan === "free" ? "gemini" : "claude";
}
