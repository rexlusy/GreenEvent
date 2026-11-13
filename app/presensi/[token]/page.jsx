import { notFound } from "next/navigation";
import { checkIn } from "@/app/actions.js";
import { ActionForm } from "@/components/action-form.jsx";
import { AttendanceStatus, Back } from "@/components/common.jsx";
import { UUID, wib } from "@/lib/format.js";
import { requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Presensi kegiatan", robots: { index: false } };

export default async function CheckInPage({ params }) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();
  await requireRole("participant", "/presensi/" + token);
  const db = await getSupabase();
  const { data, error } = await db.rpc("ge_checkin_info", { p_token: token });
  const entry = data?.[0];
  if (!entry) return <section className="panel single-panel">
    <h1>Presensi belum tersedia</h1>
    <p className="notice error" role="alert">{error?.code === "P0001" ? error.message : "Tautan presensi tidak dapat dibuka."}</p>
    <Back href="/kegiatan-saya">Kegiatan saya</Back>
  </section>;
  return <section className="panel single-panel">
    <Back href={"/kegiatan/" + entry.event_id}>Detail kegiatan</Back>
    <h1>Presensi kegiatan</h1>
    <p className="large">{entry.title}</p>
    {entry.recorded_at ? <>
      <AttendanceStatus attendance={entry} />
      <p className="muted">Presensi dicatat pada {wib(entry.recorded_at, true)}.</p>
      <a className="button" href="/kegiatan-saya">Kegiatan saya →</a>
    </> : <>
      <p className="muted">Presensi berakhir {wib(entry.closes_at, true)}.</p>
      <ActionForm action={checkIn.bind(null, token)}><button type="submit" className="button">Konfirmasi hadir →</button></ActionForm>
    </>}
  </section>;
}
