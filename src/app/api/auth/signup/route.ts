import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { WelcomeEmail } from "@/emails/welcome";
import { VerifyEmail } from "@/emails/verify-email";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;
  const password: string | undefined = body?.password;

  if (!email || !password || password.length < 10) {
    return NextResponse.json({ error: "Enter a work email and a password of at least 10 characters." }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { redirectTo: `${origin}/auth/callback?next=/app` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 400 });
  }

  const verifyUrl = data.properties.action_link;

  await Promise.all([
    sendEmail({ to: email, subject: "Welcome to Claira Slate", react: WelcomeEmail({ email }) }),
    sendEmail({ to: email, subject: "Verify your email", react: VerifyEmail({ verifyUrl }) }),
  ]);

  return NextResponse.json({ ok: true });
}
