import { EventForm } from "@/components/event-form.jsx";
import { requireRole } from "@/lib/queries.js";

export const metadata = { title: "Buat kegiatan" };
export default async function NewEvent() {
  await requireRole("organizer", "/panitia");
  return <EventForm />;
}
