import { redirect } from "next/navigation";
import { ActionForm } from "./action-form.jsx";
import { Back } from "./common.jsx";
import { signIn, signUp } from "@/app/actions.js";
import { authLink, safeNext } from "@/lib/format.js";
import { getProfile } from "@/lib/queries.js";

export async function AuthPanel({ signup = false, searchParams }) {
  const params = await searchParams;
  const next = safeNext(params.lanjut);
  const profile = await getProfile();
  if (profile) redirect(profile.role === "organizer" ? "/panitia" : next && next !== "/panitia" ? next : "/kegiatan-saya");
  const title = signup ? "Buat akun peserta" : "Masuk";
  return <div className="auth-layout">
    <div className="auth-photo">
      <picture><source media="(max-width: 700px)" srcSet="/images/kampus-480.v1.webp" />
        <img src="/images/kampus-900.v1.webp" width="900" height="600" alt="" loading="lazy" /></picture>
    </div>
    <section className="auth-card">
      <Back href="/">Kembali ke agenda</Back>
      <h1>{title}</h1>
      <p className="muted">{signup ? "Gunakan akun ini untuk mendaftar, presensi, dan mengambil sertifikat." : "Masuk ke akun peserta atau panitia."}</p>
      {params.konfirmasi === "gagal" && <p className="notice error" role="alert">Tautan konfirmasi tidak dapat dipakai. Coba masuk atau daftar kembali.</p>}
      <ActionForm action={signup ? signUp : signIn}>
        <input name="next" type="hidden" value={next} />
        {signup && <label>Nama lengkap <input name="name" autoComplete="name" minLength={2} maxLength={100} required /></label>}
        <label>Email <input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
        <label>Kata sandi <input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={10} maxLength={72} required />
          {signup && <span className="hint">Minimal 10 karakter.</span>}
        </label>
        <button type="submit" className="button">{title} <span aria-hidden="true">→</span></button>
      </ActionForm>
      <p className="small muted">{signup ? "Sudah punya akun? " : "Belum punya akun peserta? "}
        <a className="text-link" href={authLink(signup ? "/masuk" : "/daftar", next)}>{signup ? "Masuk" : "Buat akun"}</a>
      </p>
    </section>
  </div>;
}
