import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";

export default function CoachEventsPage() {
  return (
    <EventsCalendarShell
      workspace="coach"
      eyebrow="Events"
      title="Events"
      description="Coach scheduling in local calendar mode, migrated from the Calendar Systems prototype."
    />
  );
}
