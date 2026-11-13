# GreenEvent

GreenEvent mengelola pendaftaran, presensi QR, rekap, dan sertifikat digital untuk kegiatan mahasiswa. Panitia dapat membandingkan estimasi CO₂e administrasi sebelum dan sesudah menggunakan aplikasi.

**Stack** — Next.js 16 App Router dan React untuk antarmuka, Server Actions serta Route Handlers pada runtime Node.js untuk backend, dan Supabase Auth serta PostgreSQL untuk autentikasi dan penyimpanan. Satu proses Next.js menjalankan frontend dan backend.

## Jalankan di laptop

Butuh **Node.js 22 atau lebih baru**, npm, dan satu proyek Supabase. Gunakan PowerShell pada Windows.

1. Klon dan pasang dependensi.

   ~~~powershell
   git clone https://github.com/rexlusy/GreenEvent.git
   cd GreenEvent
   npm ci
   Copy-Item .env.example .env.local
   ~~~

2. Di **Supabase → SQL Editor**, jalankan seluruh isi [migrasi GreenEvent](supabase/migrations/202611130001_greenevent.sql) sekali pada proyek yang disiapkan untuk GreenEvent.
3. Dari **Supabase → Connect**, salin Project URL dan Publishable key ke .env.local. Pakai URL yang sama dengan alamat yang akan dibuka di browser.

   ~~~dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ~~~

4. Di **Supabase → Authentication → URL Configuration**, set **Site URL** sesuai nilai NEXT_PUBLIC_SITE_URL dan tambahkan http://localhost:3000/auth/konfirmasi serta http://localhost:3000/auth/konfirmasi?lanjut=** ke **Redirect URLs**. Saat mengaktifkan konfirmasi email, pastikan pengiriman email Supabase tersedia. Template email bawaan memakai PKCE dan paling mudah diuji saat tautan konfirmasi dibuka di browser yang sama. Untuk konfirmasi lintas perangkat, template dapat mengirim {{ .SiteURL }}/auth/konfirmasi?token_hash={{ .TokenHash }}.
5. Jalankan server, lalu buka [http://localhost:3000](http://localhost:3000).

   ~~~powershell
   npm run dev
   ~~~

Di macOS atau Linux, gunakan cp .env.example .env.local pada langkah 1. Untuk build produksi, jalankan npm run build lalu npm start. Atur NEXT_PUBLIC_SITE_URL ke origin HTTPS aplikasi dan samakan pengaturan URL di Supabase.

## Akun panitia

Pengguna yang mendaftar dari halaman web mendapatkan peran peserta. Untuk membuat panitia, buat pengguna terkonfirmasi dari **Supabase → Authentication → Users** atau gunakan akun peserta yang sudah terkonfirmasi. Jalankan SQL berikut dari SQL Editor dengan email panitia yang benar.

~~~sql
update public.profiles p
set role = 'organizer'
from auth.users u
where p.id = u.id and lower(u.email) = lower('email-panitia@example.com');
~~~

## Demo dengan data simulasi

Untuk mempercepat demo di proyek Supabase pengujian, isi SUPABASE_SECRET_KEY dengan secret key server dan GREENEVENT_DEMO_PASSWORD dengan kata sandi khusus demo (minimal 10 karakter). Kemudian jalankan npm run seed:demo. Skrip membuat dua akun berikut serta tiga kegiatan contoh. Simpan nilai secret key hanya di .env.local.

| Peran | Email | Kata sandi |
| --- | --- | --- |
| Panitia | panitia@greenevent.example | Nilai GREENEVENT_DEMO_PASSWORD |
| Peserta | peserta@greenevent.example | Nilai GREENEVENT_DEMO_PASSWORD |

1. Masuk sebagai **panitia** dan buka **Kampus Minim Sampah** di Dashboard panitia. Untuk mendemokan pembuatan acara, pilih **Buat kegiatan**, simpan draf, lalu **Terbitkan dan buka pendaftaran**.
2. Di profil browser lain atau jendela privat, masuk sebagai **peserta**, buka kegiatan yang sama, dan pilih **Daftar kegiatan**.
3. Panitia memilih **Buat QR presensi**. Jadwal bawaan membuka presensi selama kira-kira satu jam. Peserta membuka tautan QR atau memindainya, lalu memilih **Konfirmasi hadir**.
4. Muat ulang rekap panitia, pilih **Sahkan kehadiran**, kemudian **Terbitkan sertifikat**. Peserta membuka **Kegiatan saya** dan mengunduh PDF. Panitia bisa mengunduh rekap CSV.
5. Buka **Estimasi dampak**. Kegiatan Kampus Minim Sampah memiliki pengukuran **simulasi**. Pada acara baru, isi kertas dan digital pada kedua skenario A dan B. Masukkan angka nol dengan sumber jika memang tidak ada penggunaan pada salah satu komponen. Unduh CSV untuk menyimpan data mentah.

Tautan QR memakai NEXT_PUBLIC_SITE_URL. Untuk demo lokal di satu laptop, salin tautan ke jendela privat. Untuk pemindaian dari HP, gunakan URL HTTPS yang dapat diakses dari HP. Muat ulang halaman panitia saat ingin melihat pendaftaran atau presensi terbaru dari perangkat lain.

## Green Software Engineering

| Penerapan | Lokasi dan cara cek |
| --- | --- |
| WebP responsif | [Halaman agenda](app/page.jsx) memilih aset 480 px untuk layar kecil dan 900 px untuk layar besar. Cek file yang dimuat pada DevTools → Network. |
| Cache aset berkas versi | [Konfigurasi Next.js](next.config.mjs) menetapkan cache jangka panjang untuk foto dan font berkas versi. Cek Cache-Control dan transfer kunjungan ulang di Network dengan Disable cache dimatikan. Naikkan versi nama aset saat isinya berubah. |
| Halaman dirender server | [Agenda](app/page.jsx) dan halaman pengelolaan merender hasil kueri di server. JavaScript interaktif digunakan untuk formulir, penyalinan tautan, dan pengaturan tema. |
| Paginasi, indeks, dan kolom terpilih | [Kueri](lib/queries.js) mengambil kolom yang dipakai, daftar peserta menampilkan maksimum 25 baris per halaman, dan [migrasi](supabase/migrations/202611130001_greenevent.sql) menambah indeks pencarian serta relasi. |
| Mode gelap | Tombol tema menyimpan preferensi pengguna. |

Simpan ukuran transfer, jumlah permintaan, dan kondisi cache saat pengujian. Estimasi CO₂e mengikuti produksi kertas dan operasi digital pada satu kegiatan yang setara. Faktor produksi dipilih per jenis kertas. Faktor operasi digital memakai SWDM v4 dengan asumsi yang dijelaskan di dashboard. Data simulasi hanya untuk demonstrasi.

## Pengujian

~~~powershell
npm test
npm run build
~~~

Pengujian otomatis menjalankan migrasi pada PostgreSQL melalui PGlite dan menguji kuota, peran, kepemilikan, satu presensi per pendaftaran, penerbitan sertifikat, serta perhitungan dampak. Aplikasi memakai RLS dan fungsi SQL berizin terbatas agar aturan yang sama berlaku saat permintaan datang bersamaan. File PDF, CSV, dan QR pribadi dikirim dengan Cache-Control: private, no-store.
