import { EventsCalendarShell } from "@/components/features/events/events-calendar-shell";

export default function AdminEventsPage() {
  return (
    <EventsCalendarShell
      workspace="admin"
      eyebrow="Admin events"
      title="Events"
      description="Administrative scheduling in local calendar mode, migrated from the Calendar Systems prototype."
    />
  );
}
