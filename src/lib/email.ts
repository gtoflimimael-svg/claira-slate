import { Resend } from "resend";
import type { ReactNode } from "react";

let cached: Resend | null = null;

function getClient(): Resend {
  if (!cached) {
    cached = new Resend(process.env.RESEND_API_KEY!);
  }
  return cached;
}

export async function sendEmail({ to, subject, react }: { to: string; subject: string; react: ReactNode }) {
  const from = process.env.RESEND_FROM_EMAIL ?? "Claira Slate <onboarding@resend.dev>";
  const { error } = await getClient().emails.send({ from, to, subject, react });
  if (error) {
    throw new Error(`Failed to send email "${subject}" to ${to}: ${error.message}`);
  }
}
