import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";
import { getAuthSession } from "@/lib/auth/session";
import { buildEventsCalendarDirectory } from "@/lib/events/events-directory";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const session = await getAuthSession();
  const directory = await buildEventsCalendarDirectory("admin", session);

  return (
    <EventsCalendarShell
      workspace="admin"
      eyebrow="Admin events"
      title="Events"
      description="Coordinate administrative events across teams, coaches, and staff."
      directory={directory}
    />
  );
}
