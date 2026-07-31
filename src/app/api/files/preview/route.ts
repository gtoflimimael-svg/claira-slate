import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getObject } from "@/lib/storage/r2";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "Missing 'key' query param." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Anonymous-processed files live under a shared "anonymous" prefix with an
  // unguessable random key, same trust model as the presigned download URL
  // they already got back — no account needed to read either.
  const owner = user ? user.id : "anonymous";
  if (!key.startsWith(`processed/${owner}/`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const object = await getObject(key);
  if (!object) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(object.body), {
    headers: {
      "Content-Type": object.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
