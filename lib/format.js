export const CATEGORIES = ["Workshop", "Seminar", "Komunitas", "Lainnya"];
export const PAGE_SIZE = 25;
export const AGENDA_SIZE = 9;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ZONE = "Asia/Jakarta";
const calendarDate = new Intl.DateTimeFormat("id-ID", { timeZone: ZONE, day: "numeric", month: "short", year: "numeric" });
const clock = new Intl.DateTimeFormat("id-ID", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const datePart = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE, day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

export function wib(value, includeTime = false) {
  const date = new Date(value);
  const text = calendarDate.format(date);
  return includeTime ? text + " · " + clock.format(date).replace(".", ":") + " WIB" : text;
}

export function wibInput(value) {
  if (!value) return "";
  const { year, month, day, hour, minute } = Object.fromEntries(
    datePart.formatToParts(new Date(value)).filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]),
  );
  return year + "-" + month + "-" + day + "T" + hour + ":" + minute;
}

export function parseWib(value) {
  if (!/^(?:20\d{2}|2100)-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Isi tanggal dan waktu yang valid (WIB).");
  }
  const date = new Date(value + ":00+07:00");
  if (!Number.isFinite(date.getTime()) || wibInput(date) !== value) {
    throw new Error("Isi tanggal dan waktu yang valid (WIB).");
  }
  return date.toISOString();
}

export function number(value, digits = 0) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function co2(value) {
  if (value === null || value === undefined) return "—";
  if (value && Math.abs(value) < 0.000001) return (value < 0 ? "−" : "") + "< 0,000001";
  return number(value, 6);
}

export function pageNumber(value, max = 400) {
  return typeof value === "string" && /^\d{1,4}$/.test(value) ? Math.max(1, Math.min(max, Number(value))) : 1;
}

export function safeNext(value) {
  if (typeof value !== "string") return "";
  if (["/panitia", "/kegiatan-saya"].includes(value)) return value;
  const route = value.match(/^\/(presensi|kegiatan)\/([^/]+)$/);
  return route && UUID.test(route[2]) ? value : "";
}

export function authLink(path, next) {
  const valid = safeNext(next);
  return valid ? path + "?lanjut=" + encodeURIComponent(valid) : path;
}

export function csv(rows) {
  return "\ufeff" + rows.map(row => row.map(value => {
    let field = String(value ?? "");
    if (/^[\t\r\n]/.test(field) || /^[=+@-]/.test(field.trimStart())) field = "'" + field;
    return '"' + field.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n") + "\r\n";
}
