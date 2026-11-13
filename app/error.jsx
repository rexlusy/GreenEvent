"use client";

export default function PageError({ reset }) {
  return <section className="panel single-panel">
    <h1>Halaman belum dapat dimuat</h1>
    <p className="muted">Coba lagi. Jika kendala berlanjut, periksa konfigurasi Supabase dan pastikan migrasi database sudah dijalankan.</p>
    <button type="button" className="button" onClick={reset}>Coba lagi</button>
  </section>;
}
