import { EventForm } from "@/components/event-form.jsx";
import { getEvent, requireRole } from "@/lib/queries.js";
import { getSupabase } from "@/lib/supabase.js";

export const metadata = { title: "Edit kegiatan" };
export default async function EditEvent({ params }) {
  const [{ id }, profile, db] = await Promise.all([params, requireRole("organizer", "/panitia"), getSupabase()]);
  const event = await getEvent(db, id, profile.id);
  return <EventForm event={event} />;
}
