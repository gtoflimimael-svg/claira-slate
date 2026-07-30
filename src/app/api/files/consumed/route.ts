import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2 } from "@/lib/storage/r2";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const r2Key: string | undefined = body?.r2Key;
  if (!r2Key || !r2Key.startsWith(`processed/${user.id}/`)) {
    return NextResponse.json({ error: "Invalid file reference." }, { status: 400 });
  }

  await deleteFromR2(r2Key);
  const admin = createAdminClient();
  await admin.from("files").update({ status: "expired" }).eq("r2_key", r2Key).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
