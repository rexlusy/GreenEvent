import { certificatePDF } from "@/lib/certificate.js";
import { downloadAccess, downloadError, PRIVATE } from "@/lib/downloads.js";
import { UUID } from "@/lib/format.js";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return downloadError(404);
  const { db, response } = await downloadAccess("participant");
  if (response) return response;
  const { data, error } = await db.from("certificates")
    .select("code,issued_at,participant_name,event_title,event_date,organizer_name")
    .eq("registration_id", id).maybeSingle();
  if (error) return downloadError(502);
  if (!data) return downloadError(404);
  const bytes = await certificatePDF(data);
  return new Response(bytes, {
    headers: {
      ...PRIVATE, "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="' + data.code + '.pdf"',
    },
  });
}
