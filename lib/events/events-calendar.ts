export type EventsCalendarWorkspace = "coach" | "gym" | "admin";

export type CalendarEventStatus = "confirmed" | "cancelled";

export type CalendarEventColorId = "yellow" | "black" | "graphite" | "stone";

export type CalendarDayViewMode = "timeline" | "list";

export type CalendarEventSource = "seed" | "local" | "planner-season";

export type CalendarPlannerSeasonSource = {
  type: "season-planner";
  plannerProjectId: string;
  seasonPlanId: string;
  teamId: string;
  teamName: string;
  itemId: string;
  itemType: "checkpoint" | "manual-entry";
};

export type CalendarCoach = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type CalendarTeam = {
  id: string;
  name: string;
  level: string;
  assignedCoachIds: string[];
};

export type EventsCalendarDirectory = {
  teams: CalendarTeam[];
  coaches: CalendarCoach[];
};

export type CalendarEvent = {
  id: string;
  workspace: EventsCalendarWorkspace;
  date: string;
  title: string;
  start: string;
  end: string;
  note: string;
  location: string;
  colorId: CalendarEventColorId;
  reminderMinutes: number;
  allTeams: boolean;
  teamIds: string[];
  allStaff: boolean;
  coachIds: string[];
  status: CalendarEventStatus;
  cancellationReason: string;
  cancelledAt: string;
  source: CalendarEventSource;
  plannerSeasonSource: CalendarPlannerSeasonSource | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarActivityEntry = {
  id: string;
  message: string;
  createdAt: string;
};

export type CalendarEventDraft = {
  title: string;
  start: string;
  end: string;
  note: string;
  location: string;
  colorId: CalendarEventColorId;
  reminderMinutes: number;
  allTeams: boolean;
  teamIds: string[];
  allStaff: boolean;
  coachIds: string[];
};

export type CalendarWeek = {
  weekStartIso: string;
  days: Date[];
};

export type CalendarDaySummary = {
  isoDate: string;
  date: Date;
  events: CalendarEvent[];
};

export type StoredEventsCalendarState = {
  version: 1;
  viewDate: string;
  selectedDate: string;
  selectedWeekStart: string;
  weekSummaryOpen: boolean;
  dayViewMode: CalendarDayViewMode;
  events: CalendarEvent[];
  activityLog: CalendarActivityEntry[];
};

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const CALENDAR_LOCALE = "en-US";

export const HOURS = { start: 6, end: 23 } as const;

export const WORKWEEK_LENGTH = 5;

export const DEFAULT_EVENT_LOCATION = "Captive Precision Training Center";

export const DEFAULT_EVENT_COLOR_ID: CalendarEventColorId = "yellow";

export const LOCAL_STORAGE_KEY_PREFIX = "captive-precision-events-calendar-local-v1";

export const CALENDAR_COLOR_OPTIONS: Array<{ id: CalendarEventColorId; label: string }> = [
  { id: "yellow", label: "Captive yellow" },
  { id: "black", label: "Black" },
  { id: "graphite", label: "Graphite" },
  { id: "stone", label: "Stone" }
];

export const REMINDER_OPTIONS = [
  { value: 0, label: "No reminder" },
  { value: 5, label: "5 min before" },
  { value: 10, label: "10 min before" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" }
] as const;

export const EMPTY_EVENTS_CALENDAR_DIRECTORY: EventsCalendarDirectory = {
  teams: [],
  coaches: []
};

const colorIds = CALENDAR_COLOR_OPTIONS.map((option) => option.id);

function resolveDirectory(directory?: EventsCalendarDirectory) {
  return directory ?? EMPTY_EVENTS_CALENDAR_DIRECTORY;
}

export function getCalendarCoaches(_workspace: EventsCalendarWorkspace, directory?: EventsCalendarDirectory) {
  return resolveDirectory(directory).coaches;
}

export function getCalendarTeams(_workspace: EventsCalendarWorkspace, directory?: EventsCalendarDirectory) {
  return resolveDirectory(directory).teams;
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function getKnownTeamIds(workspace: EventsCalendarWorkspace, directory?: EventsCalendarDirectory) {
  return new Set(getCalendarTeams(workspace, directory).map((team) => team.id));
}

function getKnownCoachIds(workspace: EventsCalendarWorkspace, directory?: EventsCalendarDirectory) {
  return new Set(getCalendarCoaches(workspace, directory).map((coach) => coach.id));
}

export function getSelectedCalendarTeamIds(
  selection: Pick<CalendarEventDraft | CalendarEvent, "allTeams" | "teamIds">,
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  if (selection.allTeams) {
    return getCalendarTeams(workspace, directory).map((team) => team.id);
  }

  const knownTeamIds = getKnownTeamIds(workspace, directory);
  return uniqueStrings(selection.teamIds).filter((teamId) => knownTeamIds.has(teamId));
}

export function getAutoIncludedCoachIdsForTeams(
  teamIds: string[],
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  const selectedTeamIds = new Set(teamIds);
  return uniqueStrings(
    getCalendarTeams(workspace, directory)
      .filter((team) => selectedTeamIds.has(team.id))
      .flatMap((team) => team.assignedCoachIds)
  );
}

export function getSelectedCalendarCoachIds(
  selection: Pick<CalendarEventDraft | CalendarEvent, "allStaff" | "coachIds">,
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  if (selection.allStaff) {
    return getCalendarCoaches(workspace, directory).map((coach) => coach.id);
  }

  const knownCoachIds = getKnownCoachIds(workspace, directory);
  return uniqueStrings(selection.coachIds).filter((coachId) => knownCoachIds.has(coachId));
}

export function resolveCalendarRecipients(
  selection: Pick<CalendarEventDraft | CalendarEvent, "allTeams" | "teamIds" | "allStaff" | "coachIds">,
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  const selectedTeamIds = getSelectedCalendarTeamIds(selection, workspace, directory);
  const autoCoachIds = getAutoIncludedCoachIdsForTeams(selectedTeamIds, workspace, directory);
  const explicitCoachIds = getSelectedCalendarCoachIds(selection, workspace, directory);
  const selectedCoachIds = uniqueStrings([...autoCoachIds, ...explicitCoachIds]);
  const teams = getCalendarTeams(workspace, directory).filter((team) => selectedTeamIds.includes(team.id));
  const coaches = getCalendarCoaches(workspace, directory).filter((coach) => selectedCoachIds.includes(coach.id));

  return {
    teams,
    coaches,
    autoCoachIds,
    explicitCoachIds,
    selectedTeamIds,
    selectedCoachIds
  };
}

export function getCalendarRecipientSummary(
  selection: Pick<CalendarEventDraft | CalendarEvent, "allTeams" | "teamIds" | "allStaff" | "coachIds"> & Partial<Pick<CalendarEvent, "plannerSeasonSource">>,
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  if (selection.plannerSeasonSource) {
    return `${selection.plannerSeasonSource.teamName} · Season Planner`;
  }

  if (selection.allTeams && selection.allStaff) {
    return "All teams and all staff";
  }

  if (selection.allTeams) {
    const { coaches } = resolveCalendarRecipients(selection, workspace, directory);
    return `All teams · ${coaches.length} coach/staff included`;
  }

  if (selection.allStaff) {
    const { teams } = resolveCalendarRecipients(selection, workspace, directory);
    return teams.length ? `${teams.length} team(s) · all staff` : "All staff";
  }

  const { teams, coaches } = resolveCalendarRecipients(selection, workspace, directory);
  if (!teams.length && !coaches.length) {
    return "No teams or staff selected";
  }

  const teamLabel = teams.length === 1 ? teams[0]?.name : `${teams.length} teams`;
  const coachLabel = coaches.length === 1 ? coaches[0]?.name : `${coaches.length} coach/staff`;
  return [teamLabel, coachLabel].filter(Boolean).join(" · ");
}

export function getEventsCalendarStorageKey(workspace: EventsCalendarWorkspace) {
  return `${LOCAL_STORAGE_KEY_PREFIX}:${workspace}`;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = parseIsoDate(value);
  return !Number.isNaN(parsed.getTime()) && toIsoDate(parsed) === value;
}

export function getCalendarWeekday(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -(getCalendarWeekday(date) - 1));
}

export function getWeekStartIso(isoDate: string) {
  return toIsoDate(startOfWeek(parseIsoDate(isoDate)));
}

export function getWeekRange(weekStartIso: string) {
  const startDate = parseIsoDate(weekStartIso);
  const endDate = addDays(startDate, 6);
  return { startDate, endDate };
}

export function getWorkWeekDates(weekStartIso: string) {
  const startDate = parseIsoDate(weekStartIso);
  return Array.from({ length: WORKWEEK_LENGTH }, (_, index) => addDays(startDate, index));
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    month: "long",
    year: "numeric"
  }).format(date);
}

export function formatLongDate(isoDate: string) {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(parseIsoDate(isoDate));
}

export function formatWorkWeekRange(weekStartIso: string) {
  const dates = getWorkWeekDates(weekStartIso);
  const startDate = dates[0] ?? parseIsoDate(weekStartIso);
  const endDate = dates[dates.length - 1] ?? startDate;
  const formatter = new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    month: "short",
    day: "numeric"
  });
  return `${formatter.format(startDate)} - ${formatter.format(endDate)}`;
}

export function formatShortWeekday(isoDate: string) {
  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    weekday: "long"
  }).format(parseIsoDate(isoDate));
}

export function parseTimeToMinutes(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatCompactTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatEventDurationLabel(startTime: string, endTime: string) {
  const totalMinutes = Math.max(parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime), 0);
  if (totalMinutes === 60) {
    return "1 hour";
  }
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const hours = totalMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hours`;
}

export function getEventBlockCount(startTime: string, endTime: string) {
  const totalMinutes = Math.max(parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime), 0);
  return Math.max(1, Math.ceil(totalMinutes / 60));
}

export function normalizeReminderMinutes(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return REMINDER_OPTIONS.some((option) => option.value === parsed) ? parsed : 30;
}

export function normalizeEventColorId(value: unknown): CalendarEventColorId {
  return colorIds.includes(value as CalendarEventColorId)
    ? (value as CalendarEventColorId)
    : DEFAULT_EVENT_COLOR_ID;
}

export function normalizeEventStatus(value: unknown): CalendarEventStatus {
  return value === "cancelled" ? "cancelled" : "confirmed";
}

export function normalizeEvent(value: unknown, workspace: EventsCalendarWorkspace): CalendarEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const event = value as Partial<CalendarEvent>;
  if (
    typeof event.id !== "string" ||
    !isIsoDate(event.date) ||
    typeof event.title !== "string" ||
    typeof event.start !== "string" ||
    typeof event.end !== "string"
  ) {
    return null;
  }

  const rawTeamIds = normalizeStringArray(event.teamIds);
  const rawCoachIds = normalizeStringArray(event.coachIds);
  const source = event.source === "seed" || event.source === "planner-season" ? event.source : "local";
  return {
    id: event.id,
    workspace,
    date: event.date,
    title: event.title.trim() || "Untitled event",
    start: event.start,
    end: event.end,
    note: typeof event.note === "string" ? event.note : "",
    location: typeof event.location === "string" && event.location.trim() ? event.location : DEFAULT_EVENT_LOCATION,
    colorId: normalizeEventColorId(event.colorId),
    reminderMinutes: normalizeReminderMinutes(event.reminderMinutes),
    allTeams: event.allTeams === true,
    teamIds: rawTeamIds,
    allStaff: event.allStaff === true,
    coachIds: rawCoachIds,
    status: normalizeEventStatus(event.status),
    cancellationReason: typeof event.cancellationReason === "string" ? event.cancellationReason : "",
    cancelledAt: typeof event.cancelledAt === "string" ? event.cancelledAt : "",
    source,
    plannerSeasonSource: normalizePlannerSeasonSource(event.plannerSeasonSource),
    createdAt: typeof event.createdAt === "string" ? event.createdAt : new Date().toISOString(),
    updatedAt: typeof event.updatedAt === "string" ? event.updatedAt : new Date().toISOString()
  };
}

function normalizePlannerSeasonSource(value: unknown): CalendarPlannerSeasonSource | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Partial<CalendarPlannerSeasonSource>;
  if (
    source.type !== "season-planner" ||
    typeof source.plannerProjectId !== "string" ||
    typeof source.seasonPlanId !== "string" ||
    typeof source.teamId !== "string" ||
    typeof source.teamName !== "string" ||
    typeof source.itemId !== "string" ||
    (source.itemType !== "checkpoint" && source.itemType !== "manual-entry")
  ) {
    return null;
  }

  return {
    type: "season-planner",
    plannerProjectId: source.plannerProjectId,
    seasonPlanId: source.seasonPlanId,
    teamId: source.teamId,
    teamName: source.teamName,
    itemId: source.itemId,
    itemType: source.itemType
  };
}

export function buildEmptyEventDraft(date: string): CalendarEventDraft {
  return {
    title: "",
    start: "09:00",
    end: "10:00",
    note: "",
    location: DEFAULT_EVENT_LOCATION,
    colorId: DEFAULT_EVENT_COLOR_ID,
    reminderMinutes: 30,
    allTeams: false,
    teamIds: [],
    allStaff: false,
    coachIds: []
  };
}

export function buildDraftFromEvent(event: CalendarEvent): CalendarEventDraft {
  return {
    title: event.title,
    start: event.start,
    end: event.end,
    note: event.note,
    location: event.location,
    colorId: event.colorId,
    reminderMinutes: event.reminderMinutes,
    allTeams: event.allTeams,
    teamIds: event.teamIds,
    allStaff: event.allStaff,
    coachIds: event.coachIds
  };
}

export function validateEventDraft(
  draft: CalendarEventDraft,
  workspace: EventsCalendarWorkspace,
  directory?: EventsCalendarDirectory
) {
  if (!draft.title.trim()) {
    return "Add a title before saving the event.";
  }

  if (parseTimeToMinutes(draft.end) <= parseTimeToMinutes(draft.start)) {
    return "End time must be later than the start time.";
  }

  const { selectedTeamIds, selectedCoachIds } = resolveCalendarRecipients(draft, workspace, directory);
  if (!selectedTeamIds.length && !selectedCoachIds.length) {
    return "Select at least one team or staff member.";
  }

  return "";
}

export function createCalendarEvent(
  workspace: EventsCalendarWorkspace,
  date: string,
  draft: CalendarEventDraft,
  directory?: EventsCalendarDirectory
): CalendarEvent {
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const { selectedTeamIds, explicitCoachIds } = resolveCalendarRecipients(draft, workspace, directory);
  return {
    id: `${workspace}-${date}-local-${timestamp}`,
    workspace,
    date,
    title: draft.title.trim(),
    start: draft.start,
    end: draft.end,
    note: draft.note.trim() || "Added manually",
    location: draft.location.trim() || DEFAULT_EVENT_LOCATION,
    colorId: normalizeEventColorId(draft.colorId),
    reminderMinutes: normalizeReminderMinutes(draft.reminderMinutes),
    allTeams: draft.allTeams,
    teamIds: draft.allTeams ? [] : selectedTeamIds,
    allStaff: draft.allStaff,
    coachIds: draft.allStaff ? [] : explicitCoachIds,
    status: "confirmed",
    cancellationReason: "",
    cancelledAt: "",
    source: "local",
    plannerSeasonSource: null,
    createdAt: now,
    updatedAt: now
  };
}

export function updateCalendarEventFromDraft(
  event: CalendarEvent,
  draft: CalendarEventDraft,
  directory?: EventsCalendarDirectory
): CalendarEvent {
  const { selectedTeamIds, explicitCoachIds } = resolveCalendarRecipients(draft, event.workspace, directory);
  return {
    ...event,
    title: draft.title.trim(),
    start: draft.start,
    end: draft.end,
    note: draft.note.trim() || "Added manually",
    location: draft.location.trim() || DEFAULT_EVENT_LOCATION,
    colorId: normalizeEventColorId(draft.colorId),
    reminderMinutes: normalizeReminderMinutes(draft.reminderMinutes),
    allTeams: draft.allTeams,
    teamIds: draft.allTeams ? [] : selectedTeamIds,
    allStaff: draft.allStaff,
    coachIds: draft.allStaff ? [] : explicitCoachIds,
    updatedAt: new Date().toISOString()
  };
}

export function cancelCalendarEvent(event: CalendarEvent, reason: string): CalendarEvent {
  return {
    ...event,
    status: "cancelled",
    cancellationReason: reason.trim(),
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function isEventCancelled(event: CalendarEvent) {
  return event.status === "cancelled";
}

export function getVisibleRange(viewDate: Date) {
  const monthStart = startOfMonth(viewDate);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  const leadingDays = getCalendarWeekday(monthStart) - 1;
  const rangeStart = addDays(monthStart, -leadingDays);
  const visibleDays = leadingDays + monthEnd.getDate();
  const trailingDays = (7 - (visibleDays % 7)) % 7;
  const totalCells = visibleDays + trailingDays;
  const rangeEnd = addDays(rangeStart, totalCells - 1);
  return { rangeStart, rangeEnd, totalCells };
}

export function getVisibleWeeks(viewDate: Date): CalendarWeek[] {
  const { rangeStart, totalCells } = getVisibleRange(viewDate);
  const weeks: CalendarWeek[] = [];

  for (let index = 0; index < totalCells; index += 7) {
    const days = Array.from({ length: 7 }, (_, dayIndex) => addDays(rangeStart, index + dayIndex));
    weeks.push({
      weekStartIso: toIsoDate(days[0] ?? rangeStart),
      days
    });
  }

  return weeks;
}

export function getEventsForRange(events: CalendarEvent[], rangeStart: Date, rangeEnd: Date) {
  return events
    .filter((event) => {
      const eventDate = parseIsoDate(event.date);
      return eventDate >= startOfDay(rangeStart) && eventDate <= startOfDay(rangeEnd);
    })
    .sort(sortCalendarEvents);
}

export function getEventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    acc[event.date] = [...(acc[event.date] ?? []), event].sort(sortCalendarEvents);
    return acc;
  }, {});
}

export function getMonthEvents(events: CalendarEvent[], viewDate: Date) {
  const monthStart = startOfMonth(viewDate);
  const monthEnd = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return getEventsForRange(events, monthStart, monthEnd);
}

export function getDayEvents(events: CalendarEvent[], isoDate: string) {
  return events.filter((event) => event.date === isoDate).sort(sortCalendarEvents);
}

export function getActiveWorkWeekDays(events: CalendarEvent[], weekStartIso: string): CalendarDaySummary[] {
  return getWorkWeekDates(weekStartIso)
    .map((date) => {
      const isoDate = toIsoDate(date);
      return {
        isoDate,
        date,
        events: getDayEvents(events, isoDate)
      };
    })
    .filter((entry) => entry.events.length > 0);
}

export function getCountableWeekEvents(daySummaries: CalendarDaySummary[]) {
  return daySummaries.flatMap((entry) => entry.events.filter((event) => !isEventCancelled(event)));
}

export function buildWeekCopyText(events: CalendarEvent[], weekStartIso: string) {
  const activeDays = getActiveWorkWeekDays(events, weekStartIso).map((entry) => ({
    ...entry,
    events: entry.events.filter((event) => !isEventCancelled(event))
  }));
  const lines = [formatWorkWeekRange(weekStartIso), ""];

  if (!activeDays.length) {
    lines.push("No events scheduled in this workweek.", "", "Total: 0");
    return lines.join("\n");
  }

  activeDays.forEach(({ isoDate, events: dayEvents }, index) => {
    lines.push(formatShortWeekday(isoDate));
    dayEvents.forEach((event) => {
      lines.push(
        `- ${formatCompactTime(event.start)} ${event.title} - ${formatEventDurationLabel(event.start, event.end)}`
      );
    });

    if (index < activeDays.length - 1) {
      lines.push("");
    }
  });

  const totalBlocks = activeDays
    .flatMap((entry) => entry.events)
    .reduce((sum, event) => sum + getEventBlockCount(event.start, event.end), 0);
  lines.push("", `Total: ${totalBlocks}`);
  return lines.join("\n");
}

export function buildActivityEntry(message: string): CalendarActivityEntry {
  const createdAt = new Date().toISOString();
  return {
    id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    createdAt
  };
}

export function formatActivityTime(createdAt: string) {
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(CALENDAR_LOCALE, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

export function createSeedEvents(_workspace: EventsCalendarWorkspace, _today = new Date()): CalendarEvent[] {
  return [];
}

export function createInitialActivity(_workspace: EventsCalendarWorkspace): CalendarActivityEntry[] {
  return [];
}

export function parseStoredEventsCalendarState(
  value: unknown,
  workspace: EventsCalendarWorkspace
): StoredEventsCalendarState | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const stored = value as Partial<StoredEventsCalendarState>;
  if (!isIsoDate(stored.viewDate) || !isIsoDate(stored.selectedDate)) {
    return null;
  }

  const selectedWeekStart = isIsoDate(stored.selectedWeekStart)
    ? stored.selectedWeekStart
    : getWeekStartIso(stored.selectedDate);
  const normalizedEvents = Array.isArray(stored.events)
    ? stored.events
        .map((event) => normalizeEvent(event, workspace))
        .filter((event): event is CalendarEvent => event !== null && event.source !== "seed")
    : [];
  const activityLog = Array.isArray(stored.activityLog)
    ? stored.activityLog
        .filter((entry): entry is CalendarActivityEntry => {
          return (
            entry &&
            typeof entry === "object" &&
            typeof (entry as CalendarActivityEntry).id === "string" &&
            typeof (entry as CalendarActivityEntry).message === "string" &&
            typeof (entry as CalendarActivityEntry).createdAt === "string"
          );
        })
        .slice(0, 12)
    : createInitialActivity(workspace);

  return {
    version: 1,
    viewDate: stored.viewDate,
    selectedDate: stored.selectedDate,
    selectedWeekStart,
    weekSummaryOpen: true,
    dayViewMode: stored.dayViewMode === "list" ? "list" : "timeline",
    events: normalizedEvents.length ? normalizedEvents : createSeedEvents(workspace, parseIsoDate(stored.selectedDate)),
    activityLog
  };
}

export function createDefaultEventsCalendarState(
  workspace: EventsCalendarWorkspace,
  selectedDate = toIsoDate(new Date())
): StoredEventsCalendarState {
  const parsedDate = parseIsoDate(selectedDate);
  return {
    version: 1,
    viewDate: toIsoDate(startOfMonth(parsedDate)),
    selectedDate,
    selectedWeekStart: getWeekStartIso(selectedDate),
    weekSummaryOpen: true,
    dayViewMode: "timeline",
    events: createSeedEvents(workspace, parsedDate),
    activityLog: createInitialActivity(workspace)
  };
}

export function readEventsCalendarStateFromStorage(workspace: EventsCalendarWorkspace) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getEventsCalendarStorageKey(workspace));
    const stored = raw ? parseStoredEventsCalendarState(JSON.parse(raw), workspace) : null;
    return stored ?? createDefaultEventsCalendarState(workspace);
  } catch {
    return createDefaultEventsCalendarState(workspace);
  }
}

export function writeEventsCalendarStateToStorage(workspace: EventsCalendarWorkspace, state: StoredEventsCalendarState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getEventsCalendarStorageKey(workspace), JSON.stringify(state));
}

export function upsertEventsCalendarEventsInStorage(
  workspace: EventsCalendarWorkspace,
  nextEvents: CalendarEvent[],
  shouldReplaceExisting: (event: CalendarEvent) => boolean,
  activityMessage?: string
) {
  const currentState = readEventsCalendarStateFromStorage(workspace);
  if (!currentState) {
    return;
  }

  const nextEventIds = new Set(nextEvents.map((event) => event.id));
  const retainedEvents = currentState.events.filter((event) => !shouldReplaceExisting(event) && !nextEventIds.has(event.id));
  const activityLog = activityMessage
    ? [buildActivityEntry(activityMessage), ...currentState.activityLog].slice(0, 12)
    : currentState.activityLog;

  writeEventsCalendarStateToStorage(workspace, {
    ...currentState,
    events: [...retainedEvents, ...nextEvents].sort(sortCalendarEvents),
    activityLog
  });
}

export function sortCalendarEvents(left: CalendarEvent, right: CalendarEvent) {
  if (left.date !== right.date) {
    return left.date.localeCompare(right.date);
  }

  const timeDiff = parseTimeToMinutes(left.start) - parseTimeToMinutes(right.start);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return left.title.localeCompare(right.title);
}
