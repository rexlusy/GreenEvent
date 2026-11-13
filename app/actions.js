"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { siteUrl } from "@/lib/env.js";
import { CATEGORIES, UUID, authLink, pageNumber, parseWib, safeNext } from "@/lib/format.js";
import { DatabaseError, dataOf, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

function text(form, key) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function requiredText(form, key, label, min, max) {
  const value = text(form, key);
  if ([...value].length < min || [...value].length > max) throw new Error(label + " harus " + min + "–" + max + " karakter.");
  return value;
}

function numeric(form, key, label, min, max, integer = false) {
  const value = text(form, key).replace(",", ".");
  const result = Number(value);
  if (!/^\d+(?:\.\d+)?$/.test(value) || result < min || result > max || (integer && !Number.isSafeInteger(result))) {
    throw new Error(label + " harus berada dalam rentang " + min + "–" + max + (integer ? " dan berupa bilangan bulat." : "."));
  }
  return result;
}

function identity(value) {
  if (!UUID.test(value || "")) throw new Error("Tautan kegiatan atau data tidak valid.");
  return value;
}

function failed(error) {
  if (error instanceof DatabaseError && !["P0001", "42501"].includes(error.code)) {
    console.error("GreenEvent database request:", error.code);
    return { error: "Data belum tersimpan. Coba lagi atau cek konfigurasi Supabase." };
  }
  return { error: error.message || "Aksi gagal. Coba lagi." };
}

function updatePage(path) {
  revalidatePath(path);
}

async function authenticate(form, createAccount) {
  const db = await getSupabase();
  if (!db) return { error: "Isi konfigurasi Supabase di .env.local untuk masuk." };
  const email = text(form, "email").toLowerCase();
  const password = form.get("password");
  const target = safeNext(text(form, "next"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      typeof password !== "string" || password.length < 10 || Buffer.byteLength(password) > 72) {
    return { error: "Periksa email. Kata sandi harus minimal 10 karakter dan maksimal 72 byte." };
  }
  let result;
  if (createAccount) {
    let fullName;
    try {
      fullName = requiredText(form, "name", "Nama lengkap", 2, 100);
    } catch (error) {
      return failed(error);
    }
    const callback = new URL("/auth/konfirmasi", siteUrl());
    if (target) callback.searchParams.set("lanjut", target);
    result = await db.auth.signUp({ email, password, options: {
      data: { full_name: fullName }, emailRedirectTo: callback.href,
    } });
  } else {
    result = await db.auth.signInWithPassword({ email, password });
  }
  if (result.error) {
    const { code } = result.error;
    if (code === "email_not_confirmed") return { error: "Konfirmasi email sebelum masuk." };
    if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
      return { error: "Terlalu banyak permintaan. Coba lagi beberapa saat." };
    }
    return { error: createAccount ? "Akun belum dapat dibuat. Periksa email dan kata sandi." : "Email atau kata sandi keliru." };
  }
  if (!result.data.session) return { success: "Cek email untuk mengaktifkan akun. Setelah konfirmasi, kamu bisa masuk." };
  const profile = await dataOf(db.from("profiles").select("role").eq("id", result.data.user.id).single());
  revalidatePath("/", "layout");
  redirect(profile.role === "organizer" ? "/panitia" : target && target !== "/panitia" ? target : "/kegiatan-saya", RedirectType.replace);
}

export async function signIn(_previous, form) {
  return authenticate(form, false);
}

export async function signUp(_previous, form) {
  return authenticate(form, true);
}

export async function signOut() {
  const db = await getSupabase();
  if (db) await db.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/", RedirectType.replace);
}

export async function saveEvent(id, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  let event;
  try {
    const category = text(form, "category");
    if (!CATEGORIES.includes(category)) throw new Error("Pilih kategori yang tersedia.");
    event = await dataOf(db.rpc("ge_save_event", {
      p_event: id === null ? null : identity(id),
      p_title: requiredText(form, "title", "Nama kegiatan", 3, 100),
      p_description: requiredText(form, "description", "Deskripsi", 10, 1600),
      p_category: category,
      p_venue: requiredText(form, "venue", "Lokasi", 2, 120),
      p_starts_at: parseWib(text(form, "starts_at")),
      p_capacity: numeric(form, "capacity", "Kuota", 1, 10000, true),
    }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/");
  updatePage("/panitia");
  updatePage("/kegiatan/" + event);
  redirect("/panitia/kegiatan/" + event);
}

export async function toggleRegistration(id, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  const status = text(form, "status");
  try {
    await dataOf(db.rpc("ge_registration_status", { p_event: identity(id), p_status: status }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/");
  updatePage("/panitia");
  updatePage("/panitia/kegiatan/" + id);
  updatePage("/kegiatan/" + id);
  return { success: status === "open" ? "Kegiatan terbit dan pendaftaran dibuka." : "Pendaftaran ditutup." };
}

export async function registerForEvent(id, _previous, _form) {
  await requireRole("participant", "/kegiatan/" + id);
  const db = await getSupabase();
  try {
    const result = await dataOf(db.rpc("ge_register", { p_event: identity(id) }));
    updatePage("/kegiatan/" + id);
    updatePage("/kegiatan-saya");
    updatePage("/panitia/kegiatan/" + id);
    return { success: result === "existing" ? "Kamu sudah terdaftar." : "Pendaftaran berhasil." };
  } catch (error) {
    return failed(error);
  }
}

export async function saveWindow(id, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  const closing = text(form, "windowAction") === "close";
  try {
    await dataOf(db.rpc("ge_set_window", {
      p_event: identity(id),
      p_open: closing ? null : parseWib(text(form, "opens_at")),
      p_close: closing ? null : parseWib(text(form, "closes_at")),
    }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/panitia/kegiatan/" + id);
  return { success: closing ? "Presensi ditutup." : "Jadwal dan tautan QR disimpan." };
}

export async function checkIn(token, _previous, _form) {
  await requireRole("participant", "/presensi/" + token);
  const db = await getSupabase();
  let id;
  try {
    id = await dataOf(db.rpc("ge_checkin", { p_token: identity(token) }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/presensi/" + token);
  updatePage("/kegiatan/" + id);
  updatePage("/kegiatan-saya");
  updatePage("/panitia/kegiatan/" + id);
  return { success: "Presensi tercatat. Tunggu pengesahan panitia." };
}

export async function manageAttendance(id, registration, task, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  try {
    await dataOf(db.rpc("ge_attendance_action", {
      p_event: identity(id), p_registration: identity(registration), p_action: task,
      p_note: task === "manual" ? requiredText(form, "note", "Alasan koreksi", 3, 300) : null,
    }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/panitia/kegiatan/" + id);
  updatePage("/kegiatan/" + id);
  updatePage("/kegiatan-saya");
  return { success: { manual: "Koreksi presensi disimpan.", approve: "Kehadiran disahkan.", issue: "Sertifikat diterbitkan." }[task] };
}

export async function addMeasurement(id, kind, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  const paper = kind === "paper";
  try {
    await dataOf(db.rpc("ge_add_measurement", {
      p_event: identity(id), p_kind: kind, p_scenario: text(form, "scenario"),
      p_label: requiredText(form, "label", "Nama pengukuran", 2, 100),
      p_quantity: numeric(form, "quantity", paper ? "Jumlah lembar" : "Transfer per eksekusi", 0, paper ? 10000000 : 10000000000, true),
      p_area: paper ? numeric(form, "area", "Luas per lembar", 0.0001, 10) : null,
      p_grammage: paper ? numeric(form, "grammage", "Gramatur", 1, 1000) : null,
      p_paper_factor: paper ? numeric(form, "paper_factor", "Faktor emisi kertas", 0.0001, 1000) : null,
      p_frequency: paper ? null : numeric(form, "frequency", "Frekuensi", 1, 10000000, true),
      p_source: requiredText(form, "source", "Sumber atau asumsi", 2, 250),
    }));
  } catch (error) {
    return failed(error);
  }
  updatePage("/panitia/kegiatan/" + id + "/dampak");
  return { success: "Data pengukuran disimpan." };
}

export async function removeMeasurement(id, measurement, _previous, form) {
  await requireRole("organizer", "/panitia");
  const db = await getSupabase();
  try {
    await dataOf(db.rpc("ge_remove_measurement", { p_event: identity(id), p_measurement: identity(measurement) }));
  } catch (error) {
    return failed(error);
  }
  const path = "/panitia/kegiatan/" + id + "/dampak";
  updatePage(path);
  const page = pageNumber(text(form, "page"));
  redirect(path + (page > 1 ? "?halaman=" + page : "") + "#data");
}
