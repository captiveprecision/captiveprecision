import type { TeamSeasonCheckpoint, TeamSeasonManualEntry, TeamSeasonPlan } from "@/lib/domain/season-plan";
import type { PlannerWorkspaceScope } from "@/lib/services/planner-workspace";

import {
  DEFAULT_EVENT_LOCATION,
  upsertEventsCalendarEventsInStorage,
  type CalendarEvent,
  type CalendarEventColorId,
  type EventsCalendarWorkspace
} from "./events-calendar";

type PlannerSeasonEventsSyncInput = {
  plannerProjectId: string;
  teamId: string;
  teamName: string;
  seasonPlan: TeamSeasonPlan;
  occurredAt: string;
};

function getEventsWorkspaceFromPlannerScope(scope: PlannerWorkspaceScope): EventsCalendarWorkspace {
  return scope === "gym" ? "gym" : "coach";
}

function getManualEntryColor(type: TeamSeasonManualEntry["type"]): CalendarEventColorId {
  if (type === "event") {
    return "yellow";
  }

  if (type === "choreography") {
    return "black";
  }

  return "graphite";
}

function buildPlannerSeasonCalendarEvent(input: {
  plannerProjectId: string;
  seasonPlanId: string;
  teamId: string;
  teamName: string;
  itemId: string;
  itemType: "checkpoint" | "manual-entry";
  title: string;
  date: string;
  note: string;
  colorId: CalendarEventColorId;
  occurredAt: string;
  workspace: EventsCalendarWorkspace;
}): CalendarEvent {
  return {
    id: `planner-season:${input.plannerProjectId}:${input.teamId}:${input.itemId}`,
    workspace: input.workspace,
    date: input.date,
    title: input.title,
    start: "09:00",
    end: "10:00",
    note: input.note,
    location: DEFAULT_EVENT_LOCATION,
    colorId: input.colorId,
    reminderMinutes: 30,
    allTeams: false,
    teamIds: [input.teamId],
    allStaff: false,
    coachIds: [],
    status: "confirmed",
    cancellationReason: "",
    cancelledAt: "",
    source: "planner-season",
    plannerSeasonSource: {
      type: "season-planner",
      plannerProjectId: input.plannerProjectId,
      seasonPlanId: input.seasonPlanId,
      teamId: input.teamId,
      teamName: input.teamName,
      itemId: input.itemId,
      itemType: input.itemType
    },
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt
  };
}

function buildCheckpointEvents(input: PlannerSeasonEventsSyncInput, workspace: EventsCalendarWorkspace) {
  return input.seasonPlan.checkpoints
    .filter((checkpoint): checkpoint is TeamSeasonCheckpoint & { targetDate: string } => Boolean(checkpoint.targetDate))
    .map((checkpoint) => buildPlannerSeasonCalendarEvent({
      plannerProjectId: input.plannerProjectId,
      seasonPlanId: input.seasonPlan.id,
      teamId: input.teamId,
      teamName: input.teamName,
      itemId: checkpoint.id,
      itemType: "checkpoint",
      title: `${input.teamName}: ${checkpoint.name}`,
      date: checkpoint.targetDate,
      note: [checkpoint.status, checkpoint.notes].filter(Boolean).join(" · "),
      colorId: "stone",
      occurredAt: input.occurredAt,
      workspace
    }));
}

function buildManualEntryEvents(input: PlannerSeasonEventsSyncInput, workspace: EventsCalendarWorkspace) {
  return input.seasonPlan.manualEntries
    .filter((entry): entry is TeamSeasonManualEntry & { targetDate: string } => Boolean(entry.targetDate))
    .map((entry) => buildPlannerSeasonCalendarEvent({
      plannerProjectId: input.plannerProjectId,
      seasonPlanId: input.seasonPlan.id,
      teamId: input.teamId,
      teamName: input.teamName,
      itemId: entry.id,
      itemType: "manual-entry",
      title: `${input.teamName}: ${entry.title}`,
      date: entry.targetDate,
      note: [entry.type, entry.status, entry.notes].filter(Boolean).join(" · "),
      colorId: getManualEntryColor(entry.type),
      occurredAt: input.occurredAt,
      workspace
    }));
}

export function syncSeasonPlannerEventsToEventsCalendar(
  scope: PlannerWorkspaceScope,
  input: PlannerSeasonEventsSyncInput
) {
  const workspace = getEventsWorkspaceFromPlannerScope(scope);
  const events = [
    ...buildCheckpointEvents(input, workspace),
    ...buildManualEntryEvents(input, workspace)
  ];

  upsertEventsCalendarEventsInStorage(
    workspace,
    events,
    (event) => (
      event.source === "planner-season" &&
      event.plannerSeasonSource?.plannerProjectId === input.plannerProjectId &&
      event.plannerSeasonSource.teamId === input.teamId
    ),
    `Season Planner updated Events for ${input.teamName}.`
  );
}
