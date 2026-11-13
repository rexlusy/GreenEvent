import { Back } from "@/components/common.jsx";

export default function NotFound() {
  return <section className="panel single-panel">
    <h1>Halaman tidak ditemukan</h1>
    <p className="muted">Periksa tautan atau kembali ke daftar kegiatan.</p>
    <Back href="/">Lihat agenda</Back>
  </section>;
}
