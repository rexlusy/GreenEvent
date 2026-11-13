import { saveEvent } from "@/app/actions.js";
import { CATEGORIES, wibInput } from "@/lib/format.js";
import { ActionForm } from "./action-form.jsx";
import { Back } from "./common.jsx";

export function EventForm({ event = null }) {
  const target = event ? "/panitia/kegiatan/" + event.id : "/panitia";
  return <>
    <Back href={target}>{event ? "Detail kegiatan" : "Dashboard panitia"}</Back>
    <section className="panel form-panel">
      <h1>{event ? "Edit kegiatan" : "Buat kegiatan"}</h1>
      <p className="muted">Gunakan Waktu Indonesia Barat untuk jadwal kegiatan.</p>
      <ActionForm action={saveEvent.bind(null, event?.id ?? null)}>
        <label>Nama kegiatan <input name="title" minLength={3} maxLength={100} defaultValue={event?.title} required /></label>
        <label>Deskripsi <textarea name="description" minLength={10} maxLength={1600} rows={4} defaultValue={event?.description} required /></label>
        <div className="field-grid">
          <label>Kategori <select name="category" defaultValue={event?.category || "Workshop"} required>
            {CATEGORIES.map(category => <option key={category}>{category}</option>)}
          </select></label>
          <label>Lokasi <input name="venue" minLength={2} maxLength={120} defaultValue={event?.venue} required /></label>
          <label>Jadwal mulai (WIB) <input name="starts_at" type="datetime-local" defaultValue={wibInput(event?.starts_at)} required /></label>
          <label>Kuota <input name="capacity" type="number" min={1} max={10000} defaultValue={event?.capacity ?? 50} required /></label>
        </div>
        <div className="actions">
          <button type="submit" className="button">{event ? "Simpan perubahan" : "Simpan draf"} →</button>
          <a className="text-link" href={target}>Batal</a>
        </div>
      </ActionForm>
    </section>
  </>;
}
