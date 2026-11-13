import { manageAttendance, saveWindow, toggleRegistration } from "@/app/actions.js";
import { ActionForm, CopyButton } from "@/components/action-form.jsx";
import { AttendanceStatus, Back, Category, Empty, Pagination, RegistrationStatus, Status } from "@/components/common.jsx";
import { siteUrl } from "@/lib/env.js";
import { number, PAGE_SIZE, pageNumber, wib, wibInput } from "@/lib/format.js";
import { dataOf, getEvent, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Kelola kegiatan" };

function WindowPanel({ event, window }) {
  const now = Date.now();
  const link = window && new URL("/presensi/" + window.token, siteUrl()).href;
  const active = window && new Date(window.opens_at) <= now && now < new Date(window.closes_at);
  return <section className="panel window-panel" id="presensi">
    <div className="section-head">
      <div><h2>Presensi QR</h2><p className="muted">Peserta terdaftar dapat mengisi presensi pada jam yang ditentukan.</p></div>
      <Status tone={active ? "green" : "neutral"}>{active ? "Presensi aktif" : "Presensi tidak aktif"}</Status>
    </div>
    {event.status === "draft" ? <p>Publikasikan kegiatan untuk mengatur presensi.</p> : <div className="window-grid">
      <ActionForm key={window?.token} action={saveWindow.bind(null, event.id)}>
        <label>Mulai (WIB) <input type="datetime-local" name="opens_at" defaultValue={wibInput(window?.opens_at || now)} required /></label>
        <label>Selesai (WIB) <input type="datetime-local" name="closes_at" defaultValue={wibInput(window?.closes_at || now + 3600000)} required /></label>
        <div className="actions">
          <button type="submit" className="button">{window ? "Perbarui jadwal dan QR" : "Buat QR presensi"}</button>
        </div>
        {window && <p className="hint">Pembaruan jadwal menghasilkan tautan QR baru.</p>}
      </ActionForm>
      {window && <div className="qr-panel">
        <img src={"/api/kegiatan/" + event.id + "/qr?v=" + window.token} width={180} height={180} loading="lazy"
          alt="Pindai kode QR untuk membuka presensi kegiatan" />
        <div className="stack">
          <label>Tautan untuk peserta <input id="tautan-presensi" value={link} readOnly /></label>
          <CopyButton inputId="tautan-presensi" />
          <a className="text-link small" href={"/api/kegiatan/" + event.id + "/qr?unduh=1"}>Unduh gambar QR ↓</a>
          <ActionForm action={saveWindow.bind(null, event.id)}>
            <input type="hidden" name="windowAction" value="close" />
            <button type="submit" className="button button-small button-quiet">Tutup presensi</button>
          </ActionForm>
        </div>
      </div>}
    </div>}
  </section>;
}

function Roster({ event, rows, path, page }) {
  return <section id="peserta" className="section">
    <div className="section-head">
      <div><h2>Rekap peserta</h2><p className="muted">Sahkan kehadiran sebelum menerbitkan sertifikat.</p></div>
      <a className="button button-quiet" href={"/api/kegiatan/" + event.id + "/rekap"}>Unduh CSV ↓</a>
    </div>
    {rows.length ? <div className="table-wrap"><table>
      <thead><tr><th scope="col">Peserta</th><th scope="col">Presensi</th><th scope="col">Sertifikat</th><th scope="col">Tindakan</th></tr></thead>
      <tbody>{rows.slice(0, PAGE_SIZE).map(row => {
        const task = !row.recorded_at ? "manual" : !row.approved_at ? "approve" : "issue";
        return <tr key={row.id}>
          <td><strong>{row.full_name}</strong><span className="table-meta">{row.email}</span></td>
          <td><AttendanceStatus attendance={row} />{row.recorded_at && <span className="table-meta">
            {row.method === "manual" ? "Koreksi manual · " : "QR · "}{wib(row.recorded_at, true)}
          </span>}{row.note && <span className="table-meta">{row.note}</span>}</td>
          <td>{row.certificate_code ? <Status tone="green">Terbit</Status> : "Belum terbit"}</td>
          <td>{!row.certificate_code && (task === "manual" ? <details className="manual-form">
            <summary>Koreksi presensi</summary>
            <ActionForm action={manageAttendance.bind(null, event.id, row.id, task)}>
              <label>Alasan koreksi <input name="note" minLength={3} maxLength={300} required /></label>
              <button type="submit" className="button button-small">Simpan koreksi</button>
            </ActionForm>
          </details> : <ActionForm action={manageAttendance.bind(null, event.id, row.id, task)}>
            <button type="submit" className="button button-small button-quiet">{task === "approve" ? "Sahkan kehadiran" : "Terbitkan sertifikat"}</button>
          </ActionForm>)}</td>
        </tr>;
      })}</tbody>
    </table></div> : <Empty title="Belum ada peserta di halaman ini"><p>Peserta akan muncul setelah mendaftar.</p></Empty>}
    <Pagination page={page} hasNext={page < 400 && rows.length > PAGE_SIZE} base={path} anchor="#peserta" />
  </section>;
}

export default async function ManageEvent({ params, searchParams }) {
  const [{ id }, query, profile, db] = await Promise.all([params, searchParams, requireRole("organizer", "/panitia"), getSupabase()]);
  const page = pageNumber(query.halaman);
  const event = await getEvent(db, id, profile.id);
  const [stats, window, rows] = await Promise.all([
    dataOf(db.rpc("ge_event_stats", { p_event: id }).single()),
    dataOf(db.from("attendance_windows").select("token,opens_at,closes_at").eq("event_id", id).maybeSingle()),
    dataOf(db.rpc("ge_roster", { p_event: id, p_offset: (page - 1) * PAGE_SIZE, p_limit: PAGE_SIZE + 1 })),
  ]);
  const path = "/panitia/kegiatan/" + id;
  return <>
    <Back href="/panitia">Dashboard panitia</Back>
    <div className="section-head detail-head">
      <div><Category demo={event.is_demo}>{event.category}</Category>
        <h1>{event.title}</h1><p className="muted">{wib(event.starts_at, true)} · {event.venue}</p></div>
      <div className="actions">
        <a className="button button-quiet" href={path + "/edit"}>Edit kegiatan</a>
        <a className="button" href={path + "/dampak"}>Estimasi dampak ↗</a>
      </div>
    </div>
    <dl className="stat-grid">
      {[["Terdaftar", stats.registered], ["Presensi tercatat", stats.checked_in], ["Disahkan", stats.approved], ["Sertifikat terbit", stats.issued]].map(([label, value]) =>
        <div className="stat" key={label}><dt>{label}</dt><dd>{number(value)}</dd></div>)}
    </dl>
    <section className="panel registration-panel">
      <div><h2>Pendaftaran</h2><RegistrationStatus event={event} count={stats.registered} /> <span className="small muted">Kuota {number(event.capacity)} peserta</span></div>
      <div className="actions">
        {event.status !== "draft" && <a className="text-link" href={"/kegiatan/" + id}>Halaman peserta ↗</a>}
        <ActionForm action={toggleRegistration.bind(null, id)}>
          <input type="hidden" name="status" value={event.status === "open" ? "closed" : "open"} />
          <button type="submit" className={event.status === "open" ? "button button-quiet" : "button"}>
            {event.status === "draft" ? "Terbitkan dan buka pendaftaran" : event.status === "open" ? "Tutup pendaftaran" : "Buka pendaftaran"}
          </button>
        </ActionForm>
      </div>
    </section>
    <WindowPanel event={event} window={window} />
    <Roster event={event} rows={rows} path={path} page={page} />
  </>;
}
