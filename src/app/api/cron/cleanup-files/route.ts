import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteFromR2 } from "@/lib/storage/r2";

// Scheduled sweep (see vercel.json "crons") that deletes R2 objects once
// they're actually past their real expiry, matching the "Deleted in 59:45"
// countdown shown in every tool's result panel. This replaced a client-
// triggered delete-on-download-click call that raced the download itself
// (the same-origin delete request routinely completed before the browser's
// cross-origin fetch to the R2 presigned URL did, producing NoSuchKey).
export async function GET(request: NextRequest) {
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data: expired, error } = await admin
    .from("files")
    .select("id, r2_key")
    .eq("status", "ready")
    .lt("expires_at", new Date().toISOString())
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = expired ?? [];
  let deleted = 0;
  for (const row of rows) {
    try {
      await deleteFromR2(row.r2_key);
      deleted++;
    } catch {
      // Keep sweeping the rest even if one object is already gone or the delete otherwise fails.
    }
  }

  if (rows.length > 0) {
    await admin
      .from("files")
      .update({ status: "expired" })
      .in("id", rows.map((r) => r.id));
  }

  return NextResponse.json({ swept: rows.length, deleted });
}
