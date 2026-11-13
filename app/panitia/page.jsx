import { Calendar, Category, Empty, Pagination, RegistrationStatus } from "@/components/common.jsx";
import { PAGE_SIZE, pageNumber, wib } from "@/lib/format.js";
import { getOwnedEvents, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Dashboard panitia" };

export default async function Dashboard({ searchParams }) {
  const [params, profile, db] = await Promise.all([searchParams, requireRole("organizer", "/panitia"), getSupabase()]);
  const page = pageNumber(params.halaman);
  const rows = await getOwnedEvents(db, profile.id, page);
  return <>
    <div className="section-head page-head">
      <div><h1>Dashboard panitia</h1><p className="muted">Kelola jadwal, pendaftaran, presensi, dan dampak tiap kegiatan.</p></div>
      <a className="button" href="/panitia/kegiatan/baru"><span aria-hidden="true">+</span> Buat kegiatan</a>
    </div>
    {rows.length ? <div className="list-panel">{rows.slice(0, PAGE_SIZE).map(event => {
      const path = "/panitia/kegiatan/" + event.id;
      return <article className="list-row" key={event.id}>
        <Calendar date={event.starts_at} />
        <div className="list-main">
          <Category demo={event.is_demo}>{event.category}</Category>
          <h2><a href={path}>{event.title}</a></h2><p className="meta">{wib(event.starts_at, true)} · {event.venue}</p>
        </div>
        <RegistrationStatus event={event} />
        <a className="button button-small button-quiet" href={path}>Kelola ↗</a>
      </article>;
    })}</div> : <Empty title="Belum ada kegiatan di halaman ini"><p>Buat kegiatan untuk membuka pendaftaran.</p></Empty>}
    <Pagination page={page} hasNext={page < 400 && rows.length > PAGE_SIZE} base="/panitia" />
  </>;
}
