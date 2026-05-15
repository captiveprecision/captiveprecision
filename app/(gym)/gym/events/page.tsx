import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";
import { getAuthSession } from "@/lib/auth/session";
import { buildEventsCalendarDirectory } from "@/lib/events/events-directory";

export const dynamic = "force-dynamic";

export default async function GymEventsPage() {
  const session = await getAuthSession();
  const directory = await buildEventsCalendarDirectory("gym", session);

  return (
    <EventsCalendarShell
      workspace="gym"
      eyebrow="Gym events"
      title="Events"
      description="Coordinate gym-wide events across teams, coaches, and staff."
      directory={directory}
    />
  );
}
