import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSupabase } from "./supabase.js";
import { AGENDA_SIZE, PAGE_SIZE, UUID, authLink } from "./format.js";

const EVENT_FIELDS = "id,organizer_id,organizer_name,title,description,category,venue,starts_at,capacity,status,is_demo";
export const MEASUREMENT_FIELDS = "id,scenario,kind,label,quantity,area_m2,grammage_g_m2,paper_factor,frequency,source";

export class DatabaseError extends Error {
  constructor(error) {
    super(error.message || "Permintaan ke database gagal.");
    this.code = error.code;
  }
}

export async function dataOf(query) {
  const { data, error } = await query;
  if (error) throw new DatabaseError(error);
  return data;
}

export const getProfile = cache(async () => {
  const db = await getSupabase();
  if (!db) return null;
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return dataOf(db.from("profiles").select("id,full_name,role").eq("id", data.claims.sub).maybeSingle());
});

export async function requireRole(role, target = "") {
  const profile = await getProfile();
  if (!profile) redirect(authLink("/masuk", target));
  if (profile.role !== role) redirect(role === "organizer" ? "/kegiatan-saya" : "/panitia");
  return profile;
}

export async function getAgenda(db, page, query, category) {
  return dataOf(db.rpc("ge_agenda", { p_query: query, p_category: category, p_offset: (page - 1) * AGENDA_SIZE }));
}

export async function getEvent(db, id, owner) {
  if (!UUID.test(id)) notFound();
  let query = db.from("events").select(EVENT_FIELDS).eq("id", id);
  query = owner ? query.eq("organizer_id", owner) : query.neq("status", "draft");
  const event = await dataOf(query.maybeSingle());
  if (!event) notFound();
  return event;
}

export async function getRegistration(db, id, participant) {
  return dataOf(db.from("registrations")
    .select("id,attendances(recorded_at,approved_at,certificates(code))")
    .eq("event_id", id).eq("participant_id", participant).maybeSingle());
}

export async function getMyEvents(db, participant, page) {
  const start = (page - 1) * PAGE_SIZE;
  return dataOf(db.from("registrations")
    .select("id,events(id,title,venue,starts_at,category,is_demo),attendances(recorded_at,approved_at,certificates(code))")
    .eq("participant_id", participant).order("registered_at", { ascending: false }).order("id").range(start, start + PAGE_SIZE));
}

export async function getOwnedEvents(db, organizer, page) {
  const start = (page - 1) * PAGE_SIZE;
  return dataOf(db.from("events").select("id,title,category,venue,starts_at,status,is_demo")
    .eq("organizer_id", organizer).order("starts_at", { ascending: false }).order("id").range(start, start + PAGE_SIZE));
}

export async function getMeasurements(db, id, start, limit) {
  return dataOf(db.from("measurements").select(MEASUREMENT_FIELDS)
    .eq("event_id", id).order("scenario").order("kind").order("id").range(start, start + limit - 1));
}
