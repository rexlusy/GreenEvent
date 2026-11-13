import { Back, Calendar, Category, Empty, Pagination, RegistrationStatus } from "@/components/common.jsx";
import { AGENDA_SIZE, CATEGORIES, pageNumber, wib } from "@/lib/format.js";
import { getAgenda, getProfile } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const page = pageNumber(params.halaman, 1000);
  const query = typeof params.cari === "string" ? params.cari.trim().slice(0, 100) : "";
  const category = CATEGORIES.includes(params.kategori) ? params.kategori : "";
  const db = await getSupabase();
  const [rows, profile] = await Promise.all([db ? getAgenda(db, page, query, category) : [], getProfile()]);
  const events = rows.slice(0, AGENDA_SIZE);
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-meta"><span aria-hidden="true" /> Agenda mahasiswa</p>
        <h1 id="hero-title">Temukan kegiatan kampus.</h1>
        <p>Daftar kegiatan, catat presensi lewat QR, dan unduh sertifikat digital di satu tempat.</p>
        <div className="actions">
          <a className="button" href="#agenda">Lihat agenda <span aria-hidden="true">↓</span></a>
          {!profile && <a className="text-link" href="/daftar">Buat akun peserta <span aria-hidden="true">↗</span></a>}
        </div>
      </div>
      <div className="hero-photo">
        {/* Pre-sized WebP variants keep the mobile download small without an image transform service. */}
        <picture>
          <source media="(max-width: 700px)" srcSet="/images/kampus-480.v1.webp" />
          <img src="/images/kampus-900.v1.webp" width="900" height="600" alt="Mahasiswa berkegiatan di paviliun kampus yang dikelilingi tanaman" fetchPriority="high" />
        </picture>
      </div>
    </section>
    <section id="agenda" className="section">
      <div className="section-head agenda-head">
        <div><h2>Kegiatan mendatang</h2><p className="muted">Jadwal dan pendaftaran kegiatan yang dipublikasikan panitia.</p></div>
        {db && <form className="event-filter" action="/#agenda" role="search">
          <label className="sr-only" htmlFor="cari">Cari kegiatan atau lokasi</label>
          <input id="cari" name="cari" type="search" placeholder="Cari kegiatan" defaultValue={query} maxLength={100} />
          <label className="sr-only" htmlFor="kategori">Kategori</label>
          <select id="kategori" name="kategori" defaultValue={category}>
            <option value="">Semua kategori</option>
            {CATEGORIES.map(item => <option key={item}>{item}</option>)}
          </select>
          <button type="submit" className="button button-quiet">Cari</button>
        </form>}
      </div>
      {!db && <Empty title="Hubungkan Supabase untuk mulai"><p>Isi konfigurasi .env.local sesuai petunjuk di README.</p></Empty>}
      {db && !events.length && <Empty title={query || category ? "Kegiatan tidak ditemukan" : "Belum ada kegiatan terjadwal"}>
        <p>{query || category ? "Coba kata kunci atau kategori lain." : "Kegiatan akan muncul saat panitia memublikasikannya."}</p>
        {(query || category) && <Back href="/#agenda">Tampilkan semua kegiatan</Back>}
      </Empty>}
      {events.length > 0 && <div className="event-grid">{events.map(event =>
        <article className="event-card" key={event.id}>
          <Category demo={event.is_demo}>{event.category}</Category>
          <div className="event-card-main"><Calendar date={event.starts_at} /><div>
            <h3><a href={"/kegiatan/" + event.id}>{event.title}</a></h3>
            <p className="meta">{event.venue}</p>
            <p className="meta">{wib(event.starts_at, true)}</p>
          </div></div>
          <div className="event-card-bottom">
            <RegistrationStatus event={event} count={event.registered} />
            <a className="icon-link" aria-label={"Lihat " + event.title} href={"/kegiatan/" + event.id}>↗</a>
          </div>
        </article>)}</div>}
      <Pagination page={page} hasNext={page < 1000 && rows.length > AGENDA_SIZE} base="/" query={{ cari: query, kategori: category }} anchor="#agenda" />
    </section>
  </>;
}
