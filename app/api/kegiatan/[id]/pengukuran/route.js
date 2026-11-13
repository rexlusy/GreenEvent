import { csvDownload, downloadAccess, downloadError } from "@/lib/downloads.js";
import { UUID } from "@/lib/format.js";
import { getMeasurements } from "@/lib/queries.js";

export async function GET(_request, { params }) {
  const { id } = await params;
  if (!UUID.test(id)) return downloadError(404);
  const { db, profile, response } = await downloadAccess("organizer");
  if (response) return response;
  const { data: event, error } = await db.from("events").select("id").eq("id", id).eq("organizer_id", profile.id).maybeSingle();
  if (error) return downloadError(502);
  if (!event) return downloadError(404);
  const rows = [["Skenario", "Komponen", "Pengukuran", "Lembar atau byte per eksekusi", "Luas per lembar (m²)",
    "Gramatur (g/m²)", "Faktor produksi (kg CO₂e/kg)", "Frekuensi", "Sumber"]];
  const batchSize = 250;
  try {
    for (let start = 0; ; start += batchSize) {
      const data = await getMeasurements(db, id, start, batchSize);
      for (const row of data) rows.push([
        row.scenario, row.kind, row.label, row.quantity, row.area_m2, row.grammage_g_m2, row.paper_factor, row.frequency, row.source,
      ]);
      if (data.length < batchSize) break;
    }
  } catch {
    return downloadError(502);
  }
  return csvDownload(rows, "pengukuran-" + id + ".csv");
}
