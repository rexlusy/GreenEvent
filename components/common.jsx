import { number, wib } from "@/lib/format.js";

export function Brand() {
  return <a className="wordmark" href="/" aria-label="GreenEvent · Beranda">
    <span className="brand-icon" aria-hidden="true"><i /></span>Green<span>Event</span>
  </a>;
}

export function Status({ children, tone = "neutral" }) {
  return <span className={"status status-" + tone}><span aria-hidden="true" />{children}</span>;
}

export function RegistrationStatus({ event, count }) {
  if (event.status === "draft") return <Status>Draf</Status>;
  if (event.status === "closed") return <Status>Pendaftaran ditutup</Status>;
  if (count !== undefined && count >= event.capacity) return <Status tone="waiting">Kuota penuh</Status>;
  return <Status tone="green">Pendaftaran dibuka</Status>;
}

export function AttendanceStatus({ attendance }) {
  if (attendance?.approved_at) return <Status tone="green">Kehadiran disahkan</Status>;
  if (attendance?.recorded_at) return <Status tone="waiting">Menunggu pengesahan</Status>;
  return <Status>Belum presensi</Status>;
}

export function Category({ children, demo }) {
  return <span className="actions categories"><span className="category">{children}</span>{demo && <span className="demo-mark">Demo</span>}</span>;
}

export function Calendar({ date }) {
  const [day, month] = wib(date).split(" ");
  return <div className="calendar" aria-hidden="true"><span>{month}</span><strong>{day}</strong></div>;
}

export function Pagination({ page, hasNext, base, query = {}, anchor = "" }) {
  if (page === 1 && !hasNext) return null;
  function link(next) {
    return base + "?" + new URLSearchParams({ ...query, halaman: String(next) }) + anchor;
  }
  return <nav className="pagination" aria-label="Paginasi">
    {page > 1 && <a className="button button-small button-quiet" href={link(page - 1)}>← Sebelumnya</a>}
    <span>Halaman {number(page)}</span>
    {hasNext && <a className="button button-small button-quiet" href={link(page + 1)}>Berikutnya →</a>}
  </nav>;
}

export function Fact({ label, children }) {
  return <div className="fact"><dt>{label}</dt><dd>{children}</dd></div>;
}

export function Empty({ title, children }) {
  return <div className="empty"><strong>{title}</strong>{children && <div className="muted">{children}</div>}</div>;
}

export function Back({ href, children }) {
  return <a className="back-link" href={href}>← {children}</a>;
}
