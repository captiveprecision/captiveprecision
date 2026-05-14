"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import {
  CALENDAR_COLOR_OPTIONS,
  DAY_NAMES,
  DEFAULT_EVENT_LOCATION,
  HOURS,
  REGISTERED_GUESTS,
  REMINDER_OPTIONS,
  addDays,
  buildActivityEntry,
  buildDraftFromEvent,
  buildEmptyEventDraft,
  buildWeekCopyText,
  cancelCalendarEvent,
  createCalendarEvent,
  createInitialActivity,
  createSeedEvents,
  formatActivityTime,
  formatCompactTime,
  formatEventDurationLabel,
  formatLongDate,
  formatMonth,
  formatMinutesAsTime,
  formatWorkWeekRange,
  getActiveWorkWeekDays,
  getCountableWeekEvents,
  getDayEvents,
  getEventBlockCount,
  getEventsByDate,
  getEventsCalendarStorageKey,
  getEventsForRange,
  getMonthEvents,
  getVisibleRange,
  getVisibleWeeks,
  getWeekStartIso,
  isEventCancelled,
  parseIsoDate,
  parseStoredEventsCalendarState,
  parseTimeToMinutes,
  startOfMonth,
  toIsoDate,
  updateCalendarEventFromDraft,
  validateEventDraft,
  type CalendarActivityEntry,
  type CalendarDayViewMode,
  type CalendarEvent,
  type CalendarEventDraft,
  type CalendarGuestMode,
  type EventsCalendarWorkspace,
  type StoredEventsCalendarState
} from "@/lib/events/events-calendar";

import styles from "./events-calendar-shell.module.css";

type EventsCalendarShellProps = {
  workspace: EventsCalendarWorkspace;
  eyebrow: string;
  title: string;
  description?: string;
};

type IconName = "calendar" | "chevron-left" | "chevron-right" | "close" | "copy" | "plus" | "settings" | "save";

const HOUR_SIZE = 78;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    calendar: (
      <>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M12 14h.01" />
      </>
    ),
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2a1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9a1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1a1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6a1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9a1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.2a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V7l4-4h10l4 4v12a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v4h8" />
      </>
    )
  };

  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function buildInitialSelectedDate() {
  return toIsoDate(new Date());
}

function getGuestLabel(event: CalendarEvent) {
  if (event.guestMode === "registered") {
    const record = REGISTERED_GUESTS.find((guest) => guest.id === event.guestId);
    return record ? `${record.name} (${record.email})` : "";
  }

  if (event.guestMode === "manual" && event.guestEmail) {
    return event.guestName ? `${event.guestName} (${event.guestEmail})` : event.guestEmail;
  }

  return "";
}

function getInitialState(workspace: EventsCalendarWorkspace) {
  const selectedDate = buildInitialSelectedDate();
  const today = parseIsoDate(selectedDate);
  return {
    viewDate: startOfMonth(today),
    selectedDate,
    selectedWeekStart: getWeekStartIso(selectedDate),
    weekSummaryOpen: true,
    dayViewMode: "timeline" as CalendarDayViewMode,
    events: createSeedEvents(workspace, today),
    activityLog: createInitialActivity(workspace)
  };
}

export function EventsCalendarShell({ workspace, eyebrow, title, description }: EventsCalendarShellProps) {
  const initialState = useMemo(() => getInitialState(workspace), [workspace]);
  const [viewDate, setViewDate] = useState(initialState.viewDate);
  const [selectedDate, setSelectedDate] = useState(initialState.selectedDate);
  const [selectedWeekStart, setSelectedWeekStart] = useState(initialState.selectedWeekStart);
  const [weekSummaryOpen, setWeekSummaryOpen] = useState(initialState.weekSummaryOpen);
  const [dayViewMode, setDayViewMode] = useState<CalendarDayViewMode>(initialState.dayViewMode);
  const [events, setEvents] = useState<CalendarEvent[]>(initialState.events);
  const [activityLog, setActivityLog] = useState<CalendarActivityEntry[]>(initialState.activityLog);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerStatus, setComposerStatus] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [cancelingEventId, setCancelingEventId] = useState<string | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [weekCopied, setWeekCopied] = useState(false);
  const [draft, setDraft] = useState<CalendarEventDraft>(() => buildEmptyEventDraft(initialState.selectedDate));

  const visibleRange = useMemo(() => getVisibleRange(viewDate), [viewDate]);
  const visibleWeeks = useMemo(() => getVisibleWeeks(viewDate), [viewDate]);
  const visibleEvents = useMemo(
    () => getEventsForRange(events, visibleRange.rangeStart, visibleRange.rangeEnd),
    [events, visibleRange]
  );
  const eventsByDate = useMemo(() => getEventsByDate(visibleEvents), [visibleEvents]);
  const monthEvents = useMemo(() => getMonthEvents(events, viewDate), [events, viewDate]);
  const selectedDayEvents = useMemo(() => getDayEvents(events, selectedDate), [events, selectedDate]);
  const activeWorkWeekDays = useMemo(
    () => getActiveWorkWeekDays(events, selectedWeekStart),
    [events, selectedWeekStart]
  );
  const countableWeekEvents = useMemo(() => getCountableWeekEvents(activeWorkWeekDays), [activeWorkWeekDays]);
  const selectedEvent = useMemo(
    () => selectedDayEvents.find((event) => event.id === selectedEventId) ?? null,
    [selectedDayEvents, selectedEventId]
  );
  const registeredGuestMatches = useMemo(() => {
    const query = guestSearch.trim().toLowerCase();
    if (!query) {
      return REGISTERED_GUESTS;
    }

    return REGISTERED_GUESTS.filter((guest) => {
      return guest.name.toLowerCase().includes(query) || guest.email.toLowerCase().includes(query);
    });
  }, [guestSearch]);

  useEffect(() => {
    const baseState = getInitialState(workspace);
    setHydrated(false);

    try {
      const raw = window.localStorage.getItem(getEventsCalendarStorageKey(workspace));
      const stored = raw ? parseStoredEventsCalendarState(JSON.parse(raw), workspace) : null;
      const nextState = stored ?? {
        version: 1,
        viewDate: toIsoDate(baseState.viewDate),
        selectedDate: baseState.selectedDate,
        selectedWeekStart: baseState.selectedWeekStart,
        weekSummaryOpen: baseState.weekSummaryOpen,
        dayViewMode: baseState.dayViewMode,
        events: baseState.events,
        activityLog: baseState.activityLog
      };

      setViewDate(startOfMonth(parseIsoDate(nextState.viewDate)));
      setSelectedDate(nextState.selectedDate);
      setSelectedWeekStart(nextState.selectedWeekStart);
      setWeekSummaryOpen(nextState.weekSummaryOpen);
      setDayViewMode(nextState.dayViewMode);
      setEvents(nextState.events);
      setActivityLog(nextState.activityLog);
      setDraft(buildEmptyEventDraft(nextState.selectedDate));
    } catch {
      setViewDate(baseState.viewDate);
      setSelectedDate(baseState.selectedDate);
      setSelectedWeekStart(baseState.selectedWeekStart);
      setWeekSummaryOpen(baseState.weekSummaryOpen);
      setDayViewMode(baseState.dayViewMode);
      setEvents(baseState.events);
      setActivityLog(baseState.activityLog);
      setDraft(buildEmptyEventDraft(baseState.selectedDate));
    } finally {
      setHydrated(true);
    }
  }, [workspace]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const snapshot: StoredEventsCalendarState = {
      version: 1,
      viewDate: toIsoDate(viewDate),
      selectedDate,
      selectedWeekStart,
      weekSummaryOpen,
      dayViewMode,
      events,
      activityLog
    };

    try {
      window.localStorage.setItem(getEventsCalendarStorageKey(workspace), JSON.stringify(snapshot));
    } catch {
      // Local storage is transitional and should not block the calendar UI.
    }
  }, [
    activityLog,
    dayViewMode,
    events,
    hydrated,
    selectedDate,
    selectedWeekStart,
    viewDate,
    weekSummaryOpen,
    workspace
  ]);

  useEffect(() => {
    const visibleWeekStarts = visibleWeeks.map((week) => week.weekStartIso);
    if (!visibleWeekStarts.includes(selectedWeekStart) && visibleWeekStarts[0]) {
      setSelectedWeekStart(visibleWeekStarts[0]);
    }
  }, [selectedWeekStart, visibleWeeks]);

  useEffect(() => {
    if (!drawerOpen && !optionsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen, optionsOpen]);

  useEffect(() => {
    if (!weekCopied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setWeekCopied(false), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [weekCopied]);

  function pushActivity(message: string) {
    setActivityLog((current) => [buildActivityEntry(message), ...current].slice(0, 12));
  }

  function selectDate(isoDate: string, weekStartIso = getWeekStartIso(isoDate)) {
    setSelectedDate(isoDate);
    setSelectedWeekStart(weekStartIso);
    setSelectedEventId(null);
    setCancelingEventId(null);
    setCancelReasonDraft("");
    setDrawerOpen(true);
    setComposerStatus("");
  }

  function openAddComposer() {
    setEditingEventId(null);
    setCancelingEventId(null);
    setCancelReasonDraft("");
    setDraft(buildEmptyEventDraft(selectedDate));
    setGuestSearch("");
    setComposerStatus("");
    setComposerOpen((open) => !open);
  }

  function startEditingEvent(event: CalendarEvent) {
    setSelectedEventId(event.id);
    setCancelingEventId(null);
    setCancelReasonDraft("");
    setEditingEventId(event.id);
    setDraft(buildDraftFromEvent(event));
    setGuestSearch("");
    setComposerStatus("");
    setComposerOpen(true);
    setDrawerOpen(true);
  }

  function cancelComposer() {
    setComposerOpen(false);
    setEditingEventId(null);
    setComposerStatus("");
    setDraft(buildEmptyEventDraft(selectedDate));
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setComposerOpen(false);
    setEditingEventId(null);
    setCancelingEventId(null);
    setCancelReasonDraft("");
  }

  function handlePreviousMonth() {
    const nextViewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const nextSelectedDate = toIsoDate(nextViewDate);
    setViewDate(nextViewDate);
    setSelectedDate(nextSelectedDate);
    setSelectedWeekStart(getWeekStartIso(nextSelectedDate));
    pushActivity(`View moved to ${formatMonth(nextViewDate)}.`);
  }

  function handleNextMonth() {
    const nextViewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    const nextSelectedDate = toIsoDate(nextViewDate);
    setViewDate(nextViewDate);
    setSelectedDate(nextSelectedDate);
    setSelectedWeekStart(getWeekStartIso(nextSelectedDate));
    pushActivity(`View moved to ${formatMonth(nextViewDate)}.`);
  }

  function handleToday() {
    const today = new Date();
    const todayIso = toIsoDate(today);
    setViewDate(startOfMonth(today));
    setSelectedDate(todayIso);
    setSelectedWeekStart(getWeekStartIso(todayIso));
    setDrawerOpen(true);
    pushActivity("View returned to today.");
  }

  function shiftSelectedWeek(amount: number) {
    const nextStart = addDays(parseIsoDate(selectedWeekStart), amount * 7);
    const nextStartIso = toIsoDate(nextStart);
    setSelectedWeekStart(nextStartIso);
    setSelectedDate(nextStartIso);
    setViewDate(startOfMonth(nextStart));
    setDrawerOpen(true);
  }

  async function copySelectedWeek() {
    const text = buildWeekCopyText(events, selectedWeekStart);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }

      setWeekCopied(true);
      pushActivity(`Copied week summary for ${formatWorkWeekRange(selectedWeekStart)}.`);
    } catch {
      pushActivity("Week summary copy failed in this browser.");
    }
  }

  function setDraftField<Key extends keyof CalendarEventDraft>(field: Key, value: CalendarEventDraft[Key]) {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    const nextStart = event.target.value;
    setDraft((current) => {
      const nextStartMinutes = parseTimeToMinutes(nextStart);
      const nextEnd =
        parseTimeToMinutes(current.end) <= nextStartMinutes ? formatMinutesAsTime(nextStartMinutes + 60) : current.end;
      return {
        ...current,
        start: nextStart,
        end: nextEnd
      };
    });
  }

  function setGuestMode(mode: CalendarGuestMode) {
    setDraft((current) => ({
      ...current,
      guestMode: mode,
      guestId: mode === "registered" ? current.guestId : "",
      guestName: mode === "manual" ? current.guestName : "",
      guestEmail: mode === "manual" ? current.guestEmail : ""
    }));
    setGuestSearch("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateEventDraft(draft);
    if (validationMessage) {
      setComposerStatus(validationMessage);
      return;
    }

    if (editingEventId) {
      const editedId = editingEventId;
      setEvents((current) =>
        current.map((calendarEvent) =>
          calendarEvent.id === editedId ? updateCalendarEventFromDraft(calendarEvent, draft) : calendarEvent
        )
      );
      setSelectedEventId(editedId);
      pushActivity(`Event updated on ${formatLongDate(selectedDate)}: ${draft.title.trim()}.`);
    } else {
      const nextEvent = createCalendarEvent(workspace, selectedDate, draft);
      setEvents((current) => [...current, nextEvent]);
      setSelectedEventId(nextEvent.id);
      pushActivity(`Manual event added on ${formatLongDate(selectedDate)}: ${nextEvent.title}.`);
    }

    setComposerOpen(false);
    setEditingEventId(null);
    setComposerStatus("");
    setDrawerOpen(true);
  }

  function openCancelEvent(event: CalendarEvent) {
    if (isEventCancelled(event)) {
      return;
    }

    setSelectedEventId(event.id);
    setCancelingEventId(event.id);
    setCancelReasonDraft(event.cancellationReason);
    setComposerOpen(false);
  }

  function closeCancelEvent() {
    setCancelingEventId(null);
    setCancelReasonDraft("");
  }

  function confirmCancelEvent(event: CalendarEvent) {
    const confirmed = window.confirm(`Cancel "${event.title}" on ${formatLongDate(event.date)}?`);
    if (!confirmed) {
      return;
    }

    setEvents((current) =>
      current.map((calendarEvent) =>
        calendarEvent.id === event.id ? cancelCalendarEvent(calendarEvent, cancelReasonDraft) : calendarEvent
      )
    );
    setCancelingEventId(null);
    setCancelReasonDraft("");
    pushActivity(`Event cancelled on ${formatLongDate(event.date)}: ${event.title}.`);
  }

  function deleteEvent(event: CalendarEvent) {
    if (!isEventCancelled(event)) {
      return;
    }

    const confirmed = window.confirm(`Delete cancelled event "${event.title}" on ${formatLongDate(event.date)}?`);
    if (!confirmed) {
      return;
    }

    setEvents((current) => current.filter((calendarEvent) => calendarEvent.id !== event.id));
    if (selectedEventId === event.id) {
      setSelectedEventId(null);
    }
    pushActivity(`Cancelled event removed on ${formatLongDate(event.date)}: ${event.title}.`);
  }

  function renderEventActions(event: CalendarEvent) {
    if (isEventCancelled(event)) {
      return (
        <div className={styles.eventInlineActions}>
          <button className={styles.inlineAction} type="button" onClick={() => deleteEvent(event)}>
            Delete
          </button>
        </div>
      );
    }

    return (
      <div className={styles.eventInlineActions}>
        <button className={styles.inlineAction} type="button" onClick={() => openCancelEvent(event)}>
          Cancel
        </button>
        <button className={styles.inlineAction} type="button" onClick={() => startEditingEvent(event)}>
          Edit
        </button>
      </div>
    );
  }

  function renderEventMeta(event: CalendarEvent, noteClassName: string) {
    const guestLabel = getGuestLabel(event);
    const showCancelPanel = cancelingEventId === event.id && !isEventCancelled(event);

    return (
      <>
        {isEventCancelled(event) ? <span className={styles.eventCancelledBadge}>Cancelled</span> : null}
        <span className={noteClassName}>{event.note || "No additional notes."}</span>
        {event.location ? <span className={noteClassName}>{event.location}</span> : null}
        {guestLabel ? <span className={noteClassName}>Guest: {guestLabel}</span> : null}
        {event.cancellationReason ? (
          <span className={noteClassName}>Reason: {event.cancellationReason}</span>
        ) : null}
        {showCancelPanel ? (
          <div className={styles.cancelPanel}>
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Cancellation note</span>
              <textarea
                className={styles.fieldInput}
                rows={3}
                value={cancelReasonDraft}
                onChange={(inputEvent) => setCancelReasonDraft(inputEvent.target.value)}
                placeholder="Optional reason to include in the local record."
              />
            </label>
            <div className={styles.cancelActions}>
              <button className={styles.ghostButton} type="button" onClick={closeCancelEvent}>
                Keep event
              </button>
              <button className={styles.primaryButton} type="button" onClick={() => confirmCancelEvent(event)}>
                Cancel event
              </button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  function renderEventList() {
    if (!selectedDayEvents.length) {
      return (
        <div className={styles.drawerEmpty}>
          <strong>No events for this day.</strong>
          <p>The bottom drawer is ready for local scheduling. Google sync is intentionally disabled here.</p>
        </div>
      );
    }

    return (
      <div className={styles.eventList}>
        {selectedDayEvents.map((event) => (
          <article
            className={cx(
              styles.eventListItem,
              selectedEventId === event.id && styles.eventListItemSelected,
              isEventCancelled(event) && styles.cancelled
            )}
            data-color={event.colorId}
            key={event.id}
          >
            {renderEventActions(event)}
            <span className={styles.eventListTime}>
              {event.start} - {event.end}
            </span>
            <strong className={styles.eventListTitle}>{event.title}</strong>
            {renderEventMeta(event, styles.eventListNote)}
          </article>
        ))}
      </div>
    );
  }

  function renderTimeline() {
    if (!selectedDayEvents.length) {
      return (
        <div className={styles.drawerEmpty}>
          <strong>No events for this day.</strong>
          <p>The by-hour agenda is empty until an event is added locally.</p>
        </div>
      );
    }

    return (
      <div className={styles.timeline}>
        {Array.from({ length: HOURS.end - HOURS.start }, (_, index) => {
          const hour = HOURS.start + index;
          return (
            <div className={styles.timelineRow} key={hour}>
              <span className={styles.timelineRowLabel}>{formatMinutesAsTime(hour * 60)}</span>
            </div>
          );
        })}
        {selectedDayEvents.map((event) => {
          const startMinutes = parseTimeToMinutes(event.start);
          const endMinutes = parseTimeToMinutes(event.end);
          const top = Math.max(0, ((startMinutes - HOURS.start * 60) / 60) * HOUR_SIZE);
          const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_SIZE, selectedEventId === event.id ? 116 : 54);

          return (
            <article
              className={cx(
                styles.drawerEvent,
                selectedEventId === event.id && styles.drawerEventSelected,
                isEventCancelled(event) && styles.cancelled
              )}
              data-color={event.colorId}
              key={event.id}
              style={{ top, minHeight: height }}
            >
              {renderEventActions(event)}
              <strong className={styles.drawerEventTitle}>{event.title}</strong>
              <span className={styles.drawerEventTime}>
                {event.start} - {event.end}
              </span>
              {renderEventMeta(event, styles.drawerEventNote)}
            </article>
          );
        })}
      </div>
    );
  }

  const totalWeekBlocks = countableWeekEvents.reduce(
    (sum, event) => sum + getEventBlockCount(event.start, event.end),
    0
  );
  const todayIso = buildInitialSelectedDate();

  return (
    <main className={styles.pageShell}>
      <section className={styles.dashboard}>
        <section className={styles.calendarCard} aria-label={`${title} calendar`}>
          <div className={styles.toolbar}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <div className={styles.monthSwitcher}>
              <button className={styles.navButton} type="button" aria-label="Previous month" onClick={handlePreviousMonth}>
                <Icon name="chevron-left" />
              </button>
              <div className={styles.titleBlock}>
                <h1>{formatMonth(viewDate)}</h1>
              </div>
              <button className={styles.navButton} type="button" aria-label="Next month" onClick={handleNextMonth}>
                <Icon name="chevron-right" />
              </button>
            </div>
            {description ? <p className={styles.description}>{description}</p> : null}
            <button className={styles.navButton} type="button" onClick={handleToday}>
              <span className={styles.buttonContent}>
                <Icon name="calendar" />
                <span>Today</span>
              </span>
            </button>
          </div>

          <div className={styles.summaryRow}>
            <ul className={styles.summaryList} aria-label="Calendar summary">
              <li className={styles.summaryItem}>
                <span>Events</span>
                <span className={styles.summaryValue}>{monthEvents.length}</span>
              </li>
              <li className={styles.summaryItem}>
                <span>Selected</span>
                <span className={styles.summaryValue}>{formatLongDate(selectedDate)}</span>
              </li>
              <li className={styles.summaryItem}>
                <span>Mode</span>
                <span className={styles.summaryValue}>Local</span>
              </li>
            </ul>
            <div className={styles.cardActions}>
              <button
                className={styles.iconButton}
                type="button"
                aria-label="Options"
                aria-expanded={optionsOpen}
                onClick={() => setOptionsOpen(true)}
              >
                <Icon name="settings" />
              </button>
            </div>
          </div>

          <div className={styles.gridFrame}>
            <div className={styles.weekdayRow}>
              {DAY_NAMES.map((dayName) => (
                <div className={styles.weekdayPill} key={dayName}>
                  {dayName}
                </div>
              ))}
            </div>
            <div className={styles.calendarGrid}>
              {visibleWeeks.map(({ weekStartIso, days }) => {
                const isSelectedWeek = selectedWeekStart === weekStartIso;
                return (
                  <div
                    className={cx(
                      styles.calendarWeekRow,
                      isSelectedWeek && styles.weekSelected,
                      weekSummaryOpen && !isSelectedWeek && styles.weekCollapsed
                    )}
                    key={weekStartIso}
                  >
                    {days.map((day) => {
                      const isoDate = toIsoDate(day);
                      const dayEvents = eventsByDate[isoDate] ?? [];
                      const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                      const isSelected = isoDate === selectedDate;
                      const isToday = isoDate === todayIso;

                      return (
                        <button
                          className={cx(
                            styles.calendarDay,
                            !isCurrentMonth && styles.outsideMonth,
                            isSelected && styles.selectedDay,
                            isToday && styles.today
                          )}
                          type="button"
                          aria-pressed={isSelected}
                          key={isoDate}
                          onClick={() => selectDate(isoDate, weekStartIso)}
                        >
                          <div className={styles.dayNumberRow}>
                            <span className={styles.dayNumber}>{day.getDate()}</span>
                          </div>
                          <div className={styles.dayEventStack}>
                            {dayEvents.slice(0, 3).map((event) => (
                              <div
                                className={cx(styles.eventBar, isEventCancelled(event) && styles.cancelled)}
                                data-color={event.colorId}
                                key={event.id}
                              >
                                {event.start} - {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 ? (
                              <span className={styles.eventOverflow}>+{dayEvents.length - 3} more</span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.weeklyViewSection} aria-label="Weekly view">
            <div className={styles.weeklyViewHeader}>
              <button
                className={styles.ghostButton}
                type="button"
                aria-expanded={weekSummaryOpen}
                onClick={() => setWeekSummaryOpen((open) => !open)}
              >
                Weekly View
              </button>
            </div>
            <section
              className={cx(styles.weeklySummaryPanel, weekSummaryOpen && styles.weeklySummaryOpen)}
              aria-hidden={!weekSummaryOpen}
            >
              <div className={styles.weeklySummaryHeader}>
                <button
                  className={styles.navButton}
                  type="button"
                  aria-label="Previous week"
                  onClick={() => shiftSelectedWeek(-1)}
                >
                  <Icon name="chevron-left" />
                </button>
                <div className={styles.weeklySummaryHeading}>
                  <p className={styles.eyebrow}>Selected week</p>
                  <h2>{formatWorkWeekRange(selectedWeekStart)}</h2>
                </div>
                <button
                  className={styles.navButton}
                  type="button"
                  aria-label="Next week"
                  onClick={() => shiftSelectedWeek(1)}
                >
                  <Icon name="chevron-right" />
                </button>
              </div>
              <div className={styles.weeklySummaryList}>
                {activeWorkWeekDays.length ? (
                  activeWorkWeekDays.map(({ isoDate, events: dayEvents }) => (
                    <section
                      className={cx(
                        styles.weekSummaryDayList,
                        isoDate === selectedDate && styles.weekSummaryDayListActive
                      )}
                      key={isoDate}
                    >
                      <button
                        className={styles.weekSummaryDayHeading}
                        type="button"
                        onClick={() => selectDate(isoDate)}
                      >
                        {formatLongDate(isoDate)}
                      </button>
                      <div className={styles.weekSummaryEvents}>
                        {dayEvents.map((event) => (
                          <button
                            className={cx(styles.weekSummaryEventRow, isEventCancelled(event) && styles.cancelled)}
                            type="button"
                            key={event.id}
                            onClick={() => {
                              selectDate(event.date);
                              setSelectedEventId(event.id);
                            }}
                          >
                            <span className={styles.weekSummaryEventCheck} aria-hidden="true" />
                            <span className={styles.weekSummaryEventCopy}>
                              <span className={styles.weekSummaryEventTime}>{formatCompactTime(event.start)}</span>
                              <strong className={styles.weekSummaryEventTitle}>
                                {event.title} - {formatEventDurationLabel(event.start, event.end)}
                              </strong>
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <p className={styles.weekSummaryEmpty}>No events scheduled in this workweek.</p>
                )}
              </div>
              <div className={styles.weeklySummaryFooter}>
                <p className={styles.weekSummaryTotal}>Total: {totalWeekBlocks}</p>
                <button
                  className={styles.iconButton}
                  type="button"
                  aria-label="Copy week list"
                  onClick={copySelectedWeek}
                >
                  {weekCopied ? "Copied" : <Icon name="copy" />}
                </button>
              </div>
            </section>
          </div>
        </section>
      </section>

      {optionsOpen ? (
        <>
          <div className={styles.optionsScrim} onClick={() => setOptionsOpen(false)} />
          <aside className={styles.optionsPanel} aria-label="Calendar options">
            <button
              className={cx(styles.iconButton, styles.panelCloseButton)}
              type="button"
              aria-label="Close options"
              onClick={() => setOptionsOpen(false)}
            >
              <Icon name="close" />
            </button>
            <div className={styles.panelHeader}>
              <p className={styles.eyebrow}>Options</p>
              <strong>Local calendar mode</strong>
            </div>
            <p className={styles.optionsStatus}>
              This milestone migrates the Calendar Systems prototype as a local UI flow. Google Calendar connection,
              OAuth, and production persistence are intentionally unavailable here.
            </p>
            <button className={styles.ghostButton} type="button" disabled>
              Connect Google account
            </button>
            <label className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Destination calendar</span>
              <select className={styles.fieldInput} disabled>
                <option>Local Events workspace</option>
              </select>
            </label>
            <div className={styles.panelHeader}>
              <p className={styles.eyebrow}>Activity</p>
              <strong>Recent activity</strong>
            </div>
            <ul className={styles.activityFeed}>
              {activityLog.map((activity) => (
                <li className={styles.activityItem} key={activity.id}>
                  <p>{activity.message}</p>
                  <span className={styles.activityMeta}>{formatActivityTime(activity.createdAt)}</span>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : null}

      {drawerOpen ? <div className={styles.scrim} onClick={closeDrawer} /> : null}
      <aside className={cx(styles.dayDrawer, drawerOpen && styles.drawerOpen)} aria-hidden={!drawerOpen}>
        <div className={styles.drawerHandle} aria-hidden="true" />
        <div className={styles.drawerHeader}>
          <div className={styles.drawerTitle}>
            <p className={styles.eyebrow}>Day details</p>
            <h2>{formatLongDate(selectedDate)}</h2>
            <p className={styles.drawerSubtitle}>
              {selectedDayEvents.length
                ? `${selectedDayEvents.length} event(s) on this day.`
                : "There are no events on this date."}
            </p>
          </div>
          <button
            className={cx(styles.iconButton, styles.drawerCloseButton)}
            type="button"
            aria-label="Close panel"
            onClick={closeDrawer}
          >
            <Icon name="close" />
          </button>
          <div className={styles.drawerActions}>
            <div className={styles.viewToggle} role="group" aria-label="Choose day view">
              <button
                className={styles.toggleButton}
                type="button"
                aria-pressed={dayViewMode === "timeline"}
                onClick={() => setDayViewMode("timeline")}
              >
                Timeline
              </button>
              <button
                className={styles.toggleButton}
                type="button"
                aria-pressed={dayViewMode === "list"}
                onClick={() => setDayViewMode("list")}
              >
                List
              </button>
            </div>
            <button className={styles.primaryButton} type="button" aria-expanded={composerOpen} onClick={openAddComposer}>
              <span className={styles.buttonContent}>
                <Icon name="plus" />
                <span>Add event</span>
              </span>
            </button>
          </div>
        </div>

        <div className={styles.drawerContent}>
          {composerOpen ? (
            <form className={styles.eventComposer} onSubmit={handleSubmit}>
              <div className={styles.composerGrid}>
                <label className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Title</span>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    maxLength={60}
                    placeholder="Manual event title"
                    value={draft.title}
                    onChange={(event) => setDraftField("title", event.target.value)}
                    required
                  />
                </label>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>Start</span>
                  <input
                    className={styles.fieldInput}
                    type="time"
                    value={draft.start}
                    onChange={handleStartChange}
                    required
                  />
                </label>
                <label className={styles.fieldGroup}>
                  <span className={styles.fieldLabel}>End</span>
                  <input
                    className={styles.fieldInput}
                    type="time"
                    value={draft.end}
                    onChange={(event) => setDraftField("end", event.target.value)}
                    required
                  />
                </label>
                <label className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Notes</span>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    maxLength={80}
                    placeholder="Optional note"
                    value={draft.note}
                    onChange={(event) => setDraftField("note", event.target.value)}
                  />
                </label>
                <label className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Location</span>
                  <input
                    className={styles.fieldInput}
                    type="text"
                    maxLength={120}
                    value={draft.location}
                    onChange={(event) => setDraftField("location", event.target.value || DEFAULT_EVENT_LOCATION)}
                  />
                </label>
                <label className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Color</span>
                  <select
                    className={styles.fieldInput}
                    value={draft.colorId}
                    onChange={(event) => setDraftField("colorId", event.target.value as CalendarEventDraft["colorId"])}
                  >
                    {CALENDAR_COLOR_OPTIONS.map((option) => (
                      <option value={option.id} key={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Reminder</span>
                  <select
                    className={styles.fieldInput}
                    value={draft.reminderMinutes}
                    onChange={(event) => setDraftField("reminderMinutes", Number(event.target.value))}
                  >
                    {REMINDER_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                  <span className={styles.fieldLabel}>Guest</span>
                  <div className={styles.viewToggle} role="group" aria-label="Guest mode">
                    {(["none", "registered", "manual"] as CalendarGuestMode[]).map((mode) => (
                      <button
                        className={styles.toggleButton}
                        type="button"
                        aria-pressed={draft.guestMode === mode}
                        key={mode}
                        onClick={() => setGuestMode(mode)}
                      >
                        {mode === "none" ? "No guest" : mode === "registered" ? "Registered user" : "Manual entry"}
                      </button>
                    ))}
                  </div>
                </div>
                {draft.guestMode === "registered" ? (
                  <div className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                    <span className={styles.fieldLabel}>Registered user</span>
                    <input
                      className={styles.fieldInput}
                      type="text"
                      maxLength={120}
                      placeholder="Search users by name or email"
                      value={guestSearch}
                      onChange={(event) => setGuestSearch(event.target.value)}
                    />
                    <div className={styles.registeredGuestResults} role="listbox" aria-label="Registered users">
                      {registeredGuestMatches.map((guest) => (
                        <button
                          className={cx(
                            styles.registeredGuestButton,
                            draft.guestId === guest.id && styles.registeredGuestButtonSelected
                          )}
                          type="button"
                          key={guest.id}
                          onClick={() => {
                            setDraftField("guestId", guest.id);
                            setGuestSearch(guest.name);
                          }}
                        >
                          <strong>{guest.name}</strong>
                          <span>{guest.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {draft.guestMode === "manual" ? (
                  <div className={cx(styles.fieldGroup, styles.fieldSpan2)}>
                    <label className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Guest name</span>
                      <input
                        className={styles.fieldInput}
                        type="text"
                        maxLength={80}
                        placeholder="Optional guest name"
                        value={draft.guestName}
                        onChange={(event) => setDraftField("guestName", event.target.value)}
                      />
                    </label>
                    <label className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Guest email</span>
                      <input
                        className={styles.fieldInput}
                        type="email"
                        maxLength={120}
                        placeholder="guest@example.com"
                        value={draft.guestEmail}
                        onChange={(event) => setDraftField("guestEmail", event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              <div className={styles.composerFooter}>
                <p className={styles.composerStatus}>{composerStatus}</p>
                <div className={styles.composerActions}>
                  <button className={styles.ghostButton} type="button" onClick={cancelComposer}>
                    Cancel
                  </button>
                  <button className={styles.primaryButton} type="submit">
                    <span className={styles.buttonContent}>
                      <Icon name="save" />
                      <span>{editingEventId ? "Save changes" : "Save"}</span>
                    </span>
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {dayViewMode === "list" ? (
            <div className={styles.eventListScroll}>{renderEventList()}</div>
          ) : (
            <div className={styles.timelineScroll}>{renderTimeline()}</div>
          )}
        </div>
      </aside>
    </main>
  );
}
