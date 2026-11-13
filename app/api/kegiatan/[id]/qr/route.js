import QRCode from "qrcode";
import { downloadAccess, downloadError, PRIVATE } from "@/lib/downloads.js";
import { siteUrl } from "@/lib/env.js";
import { UUID } from "@/lib/format.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return downloadError(404);
  const { db, response } = await downloadAccess("organizer");
  if (response) return response;
  const { data, error } = await db.from("attendance_windows").select("token").eq("event_id", id).maybeSingle();
  if (error) return downloadError(502);
  if (!data) return downloadError(404);
  const link = new URL("/presensi/" + data.token, siteUrl()).href;
  const png = await QRCode.toBuffer(link, { type: "png", width: 320, margin: 4, errorCorrectionLevel: "M" });
  const headers = { ...PRIVATE, "Content-Type": "image/png" };
  if (request.nextUrl.searchParams.get("unduh") === "1") headers["Content-Disposition"] = 'attachment; filename="presensi-qr.png"';
  return new Response(png, { headers });
}
