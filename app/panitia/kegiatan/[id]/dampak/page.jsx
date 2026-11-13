import { addMeasurement, removeMeasurement } from "@/app/actions.js";
import { ActionForm } from "@/components/action-form.jsx";
import { Back, Empty, Pagination } from "@/components/common.jsx";
import { co2, number, PAGE_SIZE, pageNumber } from "@/lib/format.js";
import { DIGITAL_FACTOR, summarizeImpact } from "@/lib/impact.js";
import { dataOf, getEvent, getMeasurements, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Estimasi dampak" };

function MeasurementForm({ eventId, kind }) {
  const paper = kind === "paper";
  return <section className="panel measurement-form">
    <h3>{paper ? "Penggunaan kertas" : "Transfer data digital"}</h3>
    <ActionForm action={addMeasurement.bind(null, eventId, kind)}>
      <div className="field-grid">
        <label>Skenario <select name="scenario" required>
          <option value="A">A · Proses awal</option><option value="B">B · Dengan GreenEvent</option>
        </select></label>
        <label>{paper ? "Jumlah lembar" : "Transfer per eksekusi (byte)"}
          <input name="quantity" type="number" min={0} max={paper ? 10000000 : 10000000000} required />
        </label>
      </div>
      <label>{paper ? "Jenis dokumen" : "Nama aktivitas"}
        <input name="label" placeholder={paper ? "Contoh: sertifikat A4" : "Contoh: pendaftaran peserta"} minLength={2} maxLength={100} required />
      </label>
      {paper ? <div className="field-grid">
        <label>Luas per lembar (m²) <input name="area" type="number" min={0.0001} max={10} step="any" placeholder="0.06237 untuk A4" required /></label>
        <label>Gramatur (g/m²) <input name="grammage" type="number" min={1} max={1000} step="any" placeholder="80" required /></label>
        <label className="wide">Faktor kertas (kg CO₂e/kg) <input name="paper_factor" type="number" min={0.0001} max={1000} step="any" placeholder="1.05 untuk proksi kertas offset" required /></label>
      </div> : <label>Frekuensi eksekusi <input name="frequency" type="number" min={1} max={10000000} required /></label>}
      <label>Sumber atau asumsi <input name="source" minLength={2} maxLength={250}
        placeholder={paper ? "Contoh: rekap cetak dan Silva et al. (2015)" : "Contoh: DevTools Network, kunjungan pertama"} required /></label>
      <button type="submit" className="button button-quiet">Tambah {paper ? "data kertas" : "data digital"} <span aria-hidden="true">+</span></button>
    </ActionForm>
  </section>;
}

function Results({ result }) {
  return <div className="impact-results">
    {Object.entries(result.totals).map(([key, value]) => <section className="panel impact-total" key={key}>
      <p className="eyebrow">{key === "A" ? "A · Proses awal" : "B · Dengan GreenEvent"}</p>
      <h2>{co2(value.total)} <span>kg CO₂e</span></h2>
      <dl className="impact-breakdown">
        <div><dt>Kertas{value.sheets !== null && <small> · {number(value.sheets)} lembar</small>}</dt><dd>{co2(value.paper)}</dd></div>
        <div><dt>Operasi digital{value.transfer !== null && <small> · {number(value.transfer, 6)} GB</small>}</dt><dd>{co2(value.digital)}</dd></div>
      </dl>
    </section>)}
    <section className="panel impact-total difference">
      <p className="eyebrow">Selisih A − B</p>
      <h2>{co2(result.difference)} <span>kg CO₂e</span></h2>
      <p>{result.difference === null ? "Isi data kertas dan digital pada kedua skenario." :
        result.percent === null ? "Persentase tersedia jika emisi awal lebih dari nol." :
        number(Math.abs(result.percent), 2) + (result.percent < 0 ? "% kenaikan estimasi" : "% penurunan estimasi")}</p>
    </section>
  </div>;
}

export default async function ImpactPage({ params, searchParams }) {
  const [{ id }, query, profile, db] = await Promise.all([params, searchParams, requireRole("organizer", "/panitia"), getSupabase()]);
  const event = await getEvent(db, id, profile.id);
  const page = pageNumber(query.halaman);
  const [summary, rows] = await Promise.all([
    dataOf(db.rpc("ge_impact_totals", { p_event: id })),
    getMeasurements(db, id, (page - 1) * PAGE_SIZE, PAGE_SIZE + 1),
  ]);
  const base = "/panitia/kegiatan/" + id;
  return <>
    <Back href={base}>Kelola kegiatan</Back>
    <div className="section-head detail-head">
      <div><h1>Estimasi dampak</h1><p className="muted">{event.title}</p></div>
      <a className="button button-quiet" href={"/api/kegiatan/" + id + "/pengukuran"}>Unduh data CSV ↓</a>
    </div>
    {event.is_demo && <p className="notice neutral">Data awal kegiatan demo adalah simulasi. Gunakan data lapangan untuk laporan.</p>}
    <Results result={summarizeImpact(summary)} />
    <details className="method-note">
      <summary>Metode dan batas perhitungan</summary>
      <p>Bandingkan satu kegiatan dengan jumlah peserta dan keluaran administrasi yang setara. Isi angka 0 dengan sumber jika sebuah skenario memang tidak memakai kertas atau transfer digital.</p>
      <ul>
        <li>Kertas = lembar × luas (m²) × gramatur (g/m²) ÷ 1.000 × faktor produksi kertas (kg CO₂e/kg). Faktor 1,05 adalah proksi kertas offset menurut <a className="text-link" href="https://doi.org/10.1016/j.jclepro.2015.01.030">Silva et al. (2015)</a>.</li>
        <li>Digital = byte per eksekusi × frekuensi ÷ 10⁹ × {number(DIGITAL_FACTOR, 6)} kg CO₂e/GB. Faktor gabungan operasi memakai <a className="text-link" href="https://sustainablewebdesign.org/estimating-digital-emissions/">SWDM v4</a> dengan 494 g CO₂e/kWh dan tanpa penyesuaian hosting.</li>
        <li>Cakupan meliputi produksi kertas dan operasi digital. Catat kunjungan pertama dan kunjungan ulang secara terpisah jika hasil transfer berbeda.</li>
      </ul>
    </details>
    <section className="section">
      <div className="section-head"><div><h2>Catat pengukuran</h2><p className="muted">Masukkan satu jenis kertas atau satu aktivitas per baris.</p></div></div>
      <div className="page-grid measure-grid"><MeasurementForm eventId={id} kind="paper" /><MeasurementForm eventId={id} kind="digital" /></div>
    </section>
    <section id="data" className="section">
      <div className="section-head"><h2>Data pengukuran</h2></div>
      {rows.length ? <div className="table-wrap"><table>
        <thead><tr><th scope="col">Skenario</th><th scope="col">Pengukuran</th><th scope="col">Kuantitas</th><th scope="col">Sumber</th><th scope="col">Tindakan</th></tr></thead>
        <tbody>{rows.slice(0, PAGE_SIZE).map(row => <tr key={row.id}>
          <td>{row.scenario} · {row.scenario === "A" ? "Awal" : "GreenEvent"}</td><td><strong>{row.label}</strong>
            <span className="table-meta">{row.kind === "paper" ? "Kertas" : "Digital"}</span></td>
          <td>{number(row.quantity)} {row.kind === "paper" ? "lembar" : "byte × " + number(row.frequency)}
            {row.kind === "paper" && <span className="table-meta">{number(row.area_m2, 5)} m² · {number(row.grammage_g_m2, 1)} g/m² · faktor {number(row.paper_factor, 4)}</span>}</td>
          <td>{row.source}</td><td><details className="manual-form">
            <summary>Hapus</summary>
            <ActionForm action={removeMeasurement.bind(null, id, row.id)}>
              <input type="hidden" name="page" value={page} />
              <button type="submit" className="button button-small button-danger">Konfirmasi hapus</button>
            </ActionForm>
          </details></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Belum ada data di halaman ini"><p>Tambahkan pengukuran kertas atau aktivitas digital.</p></Empty>}
      <Pagination page={page} hasNext={page < 400 && rows.length > PAGE_SIZE} base={base + "/dampak"} anchor="#data" />
    </section>
  </>;
}
