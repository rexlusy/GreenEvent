import "server-only";
import { csv } from "./format.js";
import { getProfile } from "./queries.js";
import { getSupabase } from "./supabase.js";

export const PRIVATE = { "Cache-Control": "private, no-store" };

export function downloadError(status) {
  const text = { 401: "Masuk untuk membuka berkas.", 403: "Akses ditolak.", 404: "Berkas tidak ditemukan.", 502: "Berkas belum dapat dimuat." };
  return new Response(text[status], { status, headers: { ...PRIVATE, "Content-Type": "text/plain; charset=utf-8" } });
}

export async function downloadAccess(role) {
  const [profile, db] = await Promise.all([getProfile(), getSupabase()]);
  if (!db || !profile) return { response: downloadError(401) };
  if (profile.role !== role) return { response: downloadError(403) };
  return { profile, db };
}

export function csvDownload(rows, filename) {
  return new Response(csv(rows), {
    headers: {
      ...PRIVATE, "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
    },
  });
}
