import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const password = process.env.GREENEVENT_DEMO_PASSWORD;

if (!url || !secret || !password || password.length < 10 || Buffer.byteLength(password) > 72) {
  console.error("Isi NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, dan GREENEVENT_DEMO_PASSWORD (10 karakter atau lebih, maksimal 72 byte).");
  process.exit(1);
}

const db = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
function checked({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const accounts = [
  { email: "panitia@greenevent.example", name: "Panitia GreenEvent", role: "organizer" },
  { email: "peserta@greenevent.example", name: "Nara Pratama", role: "participant" },
];

async function demoAccount(account) {
  const data = await db.auth.admin.createUser({
    email: account.email, password, email_confirm: true,
    user_metadata: { full_name: account.name }, app_metadata: { greenevent_demo: true },
  });
  let user = data.data?.user;
  if (data.error && data.error.code !== "email_exists") throw new Error(data.error.message);
  if (!user) {
    for (let page = 1; ; page++) {
      const list = checked(await db.auth.admin.listUsers({ page, perPage: 100 }));
      user = list.users.find(candidate => candidate.email === account.email);
      if (user || list.users.length < 100) break;
    }
    if (!user?.app_metadata?.greenevent_demo) throw new Error("Email demo sudah dipakai akun lain: " + account.email);
    checked(await db.auth.admin.updateUserById(user.id, { password }));
  }
  checked(await db.from("profiles").update({ role: account.role }).eq("id", user.id).select("id").single());
  return user.id;
}

async function seed() {
  const organizer = await demoAccount(accounts[0]);
  await demoAccount(accounts[1]);

  const now = Date.now();
  const examples = [
    ["Kampus Minim Sampah", "Workshop", "Ruang Kolaborasi FILKOM", 0, 60,
      "Praktik menyusun alur acara kampus yang hemat kertas. Peserta mencoba pendaftaran, presensi QR, dan pencatatan dampak."],
    ["Desain Web Hemat Data", "Seminar", "Auditorium Kampus", 7, 100,
      "Membahas kompresi gambar, caching aset, dan cara mengukur transfer data sebuah halaman web."],
    ["Ruang Hijau, Aksi Nyata", "Komunitas", "Taman Fakultas", 14, 40,
      "Sesi komunitas untuk bertukar ide dan merancang kegiatan berkelanjutan bersama mahasiswa."],
  ];
  for (const [title, category, venue, day, capacity, description] of examples) {
    const starts_at = new Date(now + day * 86400000 + 3600000).toISOString();
    const existing = checked(await db.from("events").select("id").eq("organizer_id", organizer)
      .eq("is_demo", true).eq("title", title).maybeSingle());
    if (existing) {
      checked(await db.from("events").update({ starts_at }).eq("id", existing.id));
      continue;
    }
    const event = checked(await db.from("events").insert({
      organizer_id: organizer, organizer_name: accounts[0].name, title, category, venue,
      description, capacity, starts_at, status: "open", is_demo: true,
    }).select("id").single());
    if (day === 0) await seedMeasurements(event.id);
  }

  console.log("Akun demo siap.");
  for (const account of accounts) console.log(account.role + " · " + account.email);
  console.log("Gunakan kata sandi GREENEVENT_DEMO_PASSWORD dari .env.local.");
}

async function seedMeasurements(eventId) {
  const paper = { kind: "paper", area_m2: 0.06237, grammage_g_m2: 80, paper_factor: 1.05 };
  checked(await db.from("measurements").insert([
    { event_id: eventId, scenario: "A", ...paper, label: "Formulir dan sertifikat cetak", quantity: 120,
      source: "Simulasi demo · 60 peserta, 2 lembar per orang" },
    { event_id: eventId, scenario: "A", kind: "digital", label: "Rekap spreadsheet", quantity: 170000, frequency: 3,
      source: "Simulasi demo · transfer per eksekusi diasumsikan" },
    { event_id: eventId, scenario: "B", ...paper, label: "Administrasi digital", quantity: 0,
      source: "Simulasi demo · jumlah lembar diasumsikan nol" },
    { event_id: eventId, scenario: "B", kind: "digital", label: "Alur web peserta dan panitia", quantity: 310000, frequency: 60,
      source: "Simulasi demo · transfer per eksekusi diasumsikan" },
  ]));
}

seed().catch(error => {
  console.error("Gagal menyiapkan demo:", error.message);
  process.exitCode = 1;
});
