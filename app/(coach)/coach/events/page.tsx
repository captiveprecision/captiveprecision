import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";
import { getAuthSession } from "@/lib/auth/session";
import { buildEventsCalendarDirectory } from "@/lib/events/events-directory";

export const dynamic = "force-dynamic";

export default async function CoachEventsPage() {
  const session = await getAuthSession();
  const directory = await buildEventsCalendarDirectory("coach", session);

  return (
    <EventsCalendarShell
      workspace="coach"
      eyebrow="Events"
      title="Events"
      description="Schedule events for teams, assigned coaches, and staff."
      directory={directory}
    />
  );
}
