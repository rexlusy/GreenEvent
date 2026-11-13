import { NextResponse } from "next/server";
import { safeNext } from "@/lib/format.js";
import { siteUrl } from "@/lib/env.js";
import { getSupabase } from "@/lib/supabase.js";

export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const db = await getSupabase();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const target = safeNext(searchParams.get("lanjut")) || "/kegiatan-saya";
  let destination = "/masuk?konfirmasi=gagal";
  if (db && (code || tokenHash)) {
    const { error } = tokenHash
      ? await db.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : await db.auth.exchangeCodeForSession(code);
    if (!error) destination = target;
  }
  return NextResponse.redirect(new URL(destination, siteUrl()), {
    status: 303, headers: { "Cache-Control": "private, no-store" },
  });
}
