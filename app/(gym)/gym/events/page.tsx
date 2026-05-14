import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";

export default function GymEventsPage() {
  return (
    <EventsCalendarShell
      workspace="gym"
      eyebrow="Gym events"
      title="Events"
      description="Gym-wide scheduling in local calendar mode, migrated from the Calendar Systems prototype."
    />
  );
}
