import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { ResetPasswordEmail } from "@/emails/reset-password";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email;

  if (!email) {
    return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/reset-password` },
  });

  // Always report success regardless of whether the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (!error && data) {
    await sendEmail({
      to: email,
      subject: "Reset your password",
      react: ResetPasswordEmail({ resetUrl: data.properties.action_link }),
    });
  }

  return NextResponse.json({ ok: true });
}
