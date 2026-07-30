import Anthropic from "@anthropic-ai/sdk";
import type { AIResult } from "@/lib/ai/gemini";

let cached: Anthropic | null = null;

function getClient(): Anthropic {
  if (!cached) {
    cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return cached;
}

const CLAUDE_MODEL = "claude-haiku-4-5";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function extractText(response: Anthropic.Message): AIResult {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  return {
    text,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

export async function generateWithClaude(system: string, userMessage: string, maxTokens = 2048): Promise<AIResult> {
  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return extractText(response);
}

export async function chatWithClaude(system: string, messages: ChatTurn[], maxTokens = 2048): Promise<AIResult> {
  const response = await getClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  });
  return extractText(response);
}
