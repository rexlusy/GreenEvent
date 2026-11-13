import "./globals.css";
import { signOut } from "./actions.js";
import { Brand } from "@/components/common.jsx";
import { ThemeToggle } from "@/components/theme.jsx";
import { getProfile } from "@/lib/queries.js";

const themeScript = "try{const t=localStorage.getItem('greenevent.theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch{}";

export const metadata = {
  title: { default: "GreenEvent · Agenda mahasiswa", template: "%s | GreenEvent" },
  description: "Pendaftaran kegiatan mahasiswa, presensi QR, dan sertifikat digital.",
};
export const viewport = { colorScheme: "light dark", themeColor: "#194835" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }) {
  const profile = await getProfile();
  return <html lang="id" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
    <body>
      <a className="skip" href="#konten">Lewati ke konten</a>
      <header className="site-header"><div className="wrap header-inner">
        <Brand />
        <nav className="site-nav" aria-label="Navigasi utama">
          <a href="/#agenda">Jelajahi</a>
          {profile?.role === "organizer" && <a href="/panitia">Dashboard panitia</a>}
          {profile?.role === "participant" && <a href="/kegiatan-saya">Kegiatan saya</a>}
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          {profile ? <form action={signOut}><button type="submit" className="button button-small button-quiet">Keluar</button></form>
            : <a className="button button-small" href="/masuk">Masuk <span aria-hidden="true">↗</span></a>}
        </div>
      </div></header>
      <main id="konten" className="wrap main-content">{children}</main>
      <footer className="site-footer"><div className="wrap footer-inner">
        <a href="/" className="footer-name">GreenEvent</a><span>Sistem Informasi Berkelanjutan</span>
      </div></footer>
    </body>
  </html>;
}
