import { AttendanceStatus, Category, Empty, Pagination } from "@/components/common.jsx";
import { PAGE_SIZE, pageNumber, wib } from "@/lib/format.js";
import { getMyEvents, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Kegiatan saya" };

export default async function MyEvents({ searchParams }) {
  const [params, profile, db] = await Promise.all([searchParams, requireRole("participant", "/kegiatan-saya"), getSupabase()]);
  const page = pageNumber(params.halaman);
  const rows = await getMyEvents(db, profile.id, page);
  return <>
    <section className="section-head page-head">
      <div><h1>Kegiatan saya</h1><p className="muted">Lihat status presensi dan sertifikat kegiatanmu.</p></div>
      <a className="button button-quiet" href="/#agenda">Jelajahi kegiatan ↗</a>
    </section>
    {rows.length ? <div className="event-grid">{rows.slice(0, PAGE_SIZE).map(row => {
      const event = row.events;
      return <article className="event-card" key={row.id}>
        <Category demo={event.is_demo}>{event.category}</Category>
        <div><h2 className="card-title"><a href={"/kegiatan/" + event.id}>{event.title}</a></h2>
          <p className="meta">{wib(event.starts_at, true)}</p><p className="meta">{event.venue}</p></div>
        <div className="event-card-bottom">
          <AttendanceStatus attendance={row.attendances} />
          {row.attendances?.certificates ? <a className="button button-small" href={"/api/sertifikat/" + row.id}>Sertifikat PDF ↓</a>
            : <a className="icon-link" aria-label={"Lihat " + event.title} href={"/kegiatan/" + event.id}>↗</a>}
        </div>
      </article>;
    })}</div> : <Empty title="Belum ada pendaftaran di halaman ini"><p>Temukan kegiatan yang menarik dan daftar untuk memulai.</p></Empty>}
    <Pagination page={page} hasNext={page < 400 && rows.length > PAGE_SIZE} base="/kegiatan-saya" />
  </>;
}
