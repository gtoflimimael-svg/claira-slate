import { GoogleGenerativeAI } from "@google/generative-ai";

let cached: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!cached) {
    cached = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return cached;
}

export interface AIResult {
  text: string;
  tokensUsed: number;
}

const GEMINI_MODEL = "gemini-flash-lite-latest";

export async function generateWithGemini(prompt: string): Promise<AIResult> {
  const model = getClient().getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return {
    text: result.response.text(),
    tokensUsed: result.response.usageMetadata?.totalTokenCount ?? 0,
  };
}
