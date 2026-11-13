import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { summarizeImpact } from "../lib/impact.js";

const organizer = "10000000-0000-4000-8000-000000000001";
const anotherOrganizer = "10000000-0000-4000-8000-000000000002";
const participant = "10000000-0000-4000-8000-000000000003";
const anotherParticipant = "10000000-0000-4000-8000-000000000004";

test("GreenEvent migration enforces event, QR, certificate, and measurement rules", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec([
    "create role anon nologin;",
    "create role authenticated nologin;",
    "create role service_role nologin bypassrls;",
    "create schema auth;",
    "create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);",
    "create function auth.uid() returns uuid language sql stable as $$",
    "  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;",
    "$$;",
    "grant usage on schema auth to anon, authenticated, service_role;",
  ].join("\n"));
  await db.exec(await readFile(new URL("../supabase/migrations/202611130001_greenevent.sql", import.meta.url), "utf8"));
  for (const [id, name] of [[organizer, "Panitia Satu"], [anotherOrganizer, "Panitia Dua"],
    [participant, "Nara Pratama"], [anotherParticipant, "Siti Contoh"]]) {
    await db.query("insert into auth.users values ($1,$2,$3)", [
      id, name.replace(" ", ".") + "@greenevent.example", JSON.stringify({ full_name: name, role: "organizer" }),
    ]);
  }
  assert.equal((await db.query("select role from public.profiles where id=$1", [participant])).rows[0].role, "participant");
  await db.query("update public.profiles set role='organizer' where id in ($1,$2)", [organizer, anotherOrganizer]);

  async function as(role, id, query, args = []) {
    return db.transaction(async tx => {
      await tx.exec("set local role " + role);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id || ""]);
      return (await tx.query(query, args)).rows;
    });
  }
  const acting = (id, query, args) => as("authenticated", id, query, args);

  const [{ id: event }] = await acting(organizer, "select public.ge_save_event(null,'Kampus Minim Sampah'," +
    "'Deskripsi kegiatan kampus', 'Workshop', 'Ruang A', now(), 1) as id");
  assert.equal((await as("anon", null, "select * from public.ge_agenda('', '', 0)")).length, 0);
  await assert.rejects(acting(participant, "update public.profiles set role='organizer'"), /permission denied/);
  await assert.rejects(acting(anotherOrganizer, "select public.ge_registration_status($1,'open')", [event]), /Kegiatan tidak ditemukan/);
  await acting(organizer, "select public.ge_registration_status($1,'open')", [event]);
  const agenda = await as("anon", null, "select * from public.ge_agenda('', '', 0)");
  assert.equal(agenda[0].id, event);
  assert.equal(Number(agenda[0].registered), 0);

  for (const expected of ["registered", "existing"]) {
    const [{ result }] = await acting(participant, "select public.ge_register($1) as result", [event]);
    assert.equal(result, expected);
  }
  await assert.rejects(acting(anotherParticipant, "select public.ge_register($1)", [event]), /Kuota kegiatan sudah penuh/);
  const [{ id: registration }] = await acting(participant, "select id from public.registrations where event_id=$1", [event]);
  assert.equal((await acting(anotherParticipant, "select id from public.registrations")).length, 0);

  await acting(organizer, "select public.ge_set_window($1, now()+interval '1 day', now()+interval '2 days')", [event]);
  const window = async () => (await acting(organizer, "select token from public.attendance_windows where event_id=$1", [event]))[0].token;
  const futureToken = await window();
  await assert.rejects(acting(participant, "select public.ge_checkin($1)", [futureToken]), /belum aktif/);
  await acting(organizer, "select public.ge_set_window($1, now()-interval '5 minutes', now()+interval '1 hour')", [event]);
  const token = await window();
  assert.notEqual(token, futureToken);
  assert.equal((await acting(anotherOrganizer, "select token from public.attendance_windows")).length, 0);
  await assert.rejects(acting(anotherParticipant, "select public.ge_checkin($1)", [token]), /Daftar pada kegiatan ini/);
  const [info] = await acting(participant, "select * from public.ge_checkin_info($1)", [token]);
  assert.equal(info.event_id, event);
  await acting(participant, "select public.ge_checkin($1)", [token]);
  await acting(participant, "select public.ge_checkin($1)", [token]);
  const stats = async () => (await acting(organizer, "select * from public.ge_event_stats($1)", [event]))[0];
  assert.equal(Number((await stats()).checked_in), 1);

  const attendance = (account, action) => acting(account,
    "select public.ge_attendance_action($1,$2,$3,null)", [event, registration, action]);
  await assert.rejects(attendance(organizer, "issue"), /Sahkan kehadiran/);
  await assert.rejects(attendance(anotherOrganizer, "approve"), /Kegiatan tidak ditemukan/);
  await attendance(organizer, "approve");
  await attendance(organizer, "issue");
  await attendance(organizer, "issue");
  assert.equal(Number((await stats()).issued), 1);
  const [certificate] = await acting(participant, "select * from public.certificates");
  assert.equal(certificate.participant_name, "Nara Pratama");
  assert.equal((await acting(anotherParticipant, "select code from public.certificates")).length, 0);
  await acting(organizer, "select public.ge_set_window($1,null,null)", [event]);
  await assert.rejects(acting(participant, "select public.ge_checkin($1)", [token]), /belum aktif/);
  assert.equal((await acting(organizer, "select * from public.ge_roster($1,0,26)", [event]))[0].certificate_code, certificate.code);
  await assert.rejects(acting(anotherOrganizer, "select * from public.ge_roster($1,0,26)", [event]), /Kegiatan tidak ditemukan/);

  const paper = (scenario, qty) => acting(organizer, "select public.ge_add_measurement(" +
    "$1,$2,'paper','Sertifikat A4',$3,0.06237,80,1.05,null,'Catatan uji')", [event, scenario, qty]);
  const digital = (scenario, bytes) => acting(organizer, "select public.ge_add_measurement(" +
    "$1,$2,'digital','Pendaftaran',$3,null,null,null,100,'Catatan uji')", [event, scenario, bytes]);
  await paper("A", 100);
  await paper("B", 0);
  await digital("A", 0);
  const summary = () => acting(organizer, "select * from public.ge_impact_totals($1)", [event]);
  assert.equal(summarizeImpact(await summary()).difference, null);
  await digital("B", 1000000);
  const result = summarizeImpact(await summary());
  assert.ok(Math.abs(result.totals.A.paper - 0.523908) < 1e-12);
  assert.ok(Math.abs(result.totals.B.digital - 0.0095836) < 1e-12);
  assert.equal((await acting(participant, "select * from public.measurements")).length, 0);
  await assert.rejects(acting(anotherOrganizer, "select * from public.ge_impact_totals($1)", [event]), /Kegiatan tidak ditemukan/);
});
