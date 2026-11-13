import { csvDownload, downloadAccess, downloadError } from "@/lib/downloads.js";
import { UUID, wib } from "@/lib/format.js";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return downloadError(404);
  const { db, response } = await downloadAccess("organizer");
  if (response) return response;
  const rows = [["Nama", "Email", "Waktu pendaftaran (WIB)", "Presensi", "Metode", "Catatan koreksi", "Disahkan", "Kode sertifikat"]];
  const batchSize = 250;
  for (let start = 0; start < 10000; start += batchSize) {
    const { data, error } = await db.rpc("ge_roster", { p_event: id, p_offset: start, p_limit: batchSize });
    if (error) return downloadError(error.code === "42501" ? 404 : 502);
    for (const row of data) rows.push([
      row.full_name, row.email, wib(row.registered_at, true),
      row.recorded_at ? wib(row.recorded_at, true) : "",
      row.method, row.note, row.approved_at ? wib(row.approved_at, true) : "", row.certificate_code,
    ]);
    if (data.length < batchSize) break;
  }
  return csvDownload(rows, "rekap-" + id + ".csv");
}
