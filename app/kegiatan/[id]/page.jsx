import { registerForEvent } from "@/app/actions.js";
import { ActionForm } from "@/components/action-form.jsx";
import { AttendanceStatus, Back, Category, Fact, RegistrationStatus, Status } from "@/components/common.jsx";
import { authLink, number, wib } from "@/lib/format.js";
import { dataOf, getEvent, getProfile, getRegistration } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";
import { notFound } from "next/navigation";

export const metadata = { title: "Detail kegiatan" };

export default async function EventPage({ params }) {
  const { id } = await params;
  const db = await getSupabase();
  if (!db) notFound();
  const [event, profile] = await Promise.all([getEvent(db, id), getProfile()]);
  const [registered, registration] = await Promise.all([
    dataOf(db.rpc("ge_registered_count", { p_event: id })),
    profile?.role === "participant" ? getRegistration(db, id, profile.id) : null,
  ]);
  const target = "/kegiatan/" + id;
  return <>
    <Back href="/#agenda">Semua kegiatan</Back>
    <div className="page-grid event-page">
      <section className="panel event-intro">
        <Category demo={event.is_demo}>{event.category}</Category>
        <h1>{event.title}</h1>
        <p className="prose">{event.description}</p>
        <dl className="facts">
          <Fact label="Jadwal">{wib(event.starts_at, true)}</Fact>
          <Fact label="Lokasi">{event.venue}</Fact>
          <Fact label="Penyelenggara">{event.organizer_name}</Fact>
        </dl>
      </section>
      <aside className="panel event-side" aria-labelledby="enrol-title">
        <h2 id="enrol-title">Pendaftaran</h2>
        <RegistrationStatus event={event} count={registered} />
        <dl className="facts facts-single"><Fact label="Peserta terdaftar">{number(registered)} / {number(event.capacity)}</Fact></dl>
        {registration ? <div className="flow-box">
          <Status tone="green">Sudah terdaftar</Status>
          <AttendanceStatus attendance={registration.attendances} />
          {registration.attendances?.certificates
            ? <a className="button" href={"/api/sertifikat/" + registration.id}>Unduh sertifikat PDF ↓</a>
            : <p className="small muted">{registration.attendances?.recorded_at
              ? "Sertifikat tersedia setelah kehadiran disahkan dan sertifikat diterbitkan panitia."
              : "Pindai QR dari panitia pada jadwal presensi."}</p>}
        </div> : profile?.role === "organizer"
          ? profile.id === event.organizer_id && <a className="button button-quiet" href={"/panitia/kegiatan/" + id}>Kelola kegiatan</a>
          : event.status === "open" && registered < event.capacity && (profile
            ? <ActionForm action={registerForEvent.bind(null, id)}><button type="submit" className="button">Daftar kegiatan →</button></ActionForm>
            : <div className="flow-box">
              <a className="button" href={authLink("/masuk", target)}>Masuk untuk daftar →</a>
              <a className="text-link small" href={authLink("/daftar", target)}>Buat akun peserta</a>
            </div>)}
      </aside>
    </div>
  </>;
}
