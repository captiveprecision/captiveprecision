"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus } from "lucide-react";

import type { GymSeason, GymSeasonStatus } from "@/lib/domain/gym-season";
import { Badge, Button, Input, Select } from "@/components/ui";

type ManageGymSeasonsManagerProps = {
  initialSeasons: GymSeason[];
};

type SeasonDraft = {
  seasonId: string | null;
  seasonNumber: string;
  label: string;
  startDate: string;
  endDate: string;
  status: GymSeasonStatus;
};

const STATUS_OPTIONS: Array<{ value: GymSeasonStatus; label: string }> = [
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" }
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addOneYear(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function getNextSeasonNumber(seasons: GymSeason[]) {
  return String(Math.max(0, ...seasons.map((season) => season.seasonNumber)) + 1);
}

function createDraft(seasons: GymSeason[]): SeasonDraft {
  const startDate = todayDate();

  return {
    seasonId: null,
    seasonNumber: getNextSeasonNumber(seasons),
    label: "",
    startDate,
    endDate: addOneYear(startDate),
    status: seasons.some((season) => season.status === "active") ? "upcoming" : "active"
  };
}

function createDraftFromSeason(season: GymSeason): SeasonDraft {
  return {
    seasonId: season.id,
    seasonNumber: String(season.seasonNumber),
    label: season.label,
    startDate: season.startDate,
    endDate: season.endDate,
    status: season.status
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function statusBadgeVariant(status: GymSeasonStatus) {
  if (status === "active") {
    return "dark" as const;
  }

  return status === "upcoming" ? "accent" as const : "subtle" as const;
}

export function ManageGymSeasonsManager({ initialSeasons }: ManageGymSeasonsManagerProps) {
  const [seasons, setSeasons] = useState(initialSeasons);
  const [draft, setDraft] = useState<SeasonDraft>(() => createDraft(initialSeasons));
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeSeason = useMemo(() => seasons.find((season) => season.status === "active") ?? null, [seasons]);

  function resetDraft() {
    setDraft(createDraft(seasons));
    setNotice(null);
  }

  async function submitSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/gym/seasons", {
        method: draft.seasonId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          seasonId: draft.seasonId,
          seasonNumber: Number(draft.seasonNumber),
          label: draft.label,
          startDate: draft.startDate,
          endDate: draft.endDate,
          status: draft.status
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to save season.");
      }

      const nextSeasons = Array.isArray(payload.seasons) ? payload.seasons as GymSeason[] : seasons;
      setSeasons(nextSeasons);
      setDraft(createDraft(nextSeasons));
      setNotice({ type: "success", message: typeof payload.message === "string" ? payload.message : "Season saved." });
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to save season." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="gym-seasons-layout">
      <section className="surface-card panel-pad settings-section gym-seasons-current">
        <div>
          <span className="metric-label">Current season</span>
          <h2>{activeSeason ? activeSeason.label : "No active season"}</h2>
          <p className="page-copy">
            {activeSeason
              ? `${formatDate(activeSeason.startDate)} - ${formatDate(activeSeason.endDate)}`
              : "Create or activate a season so new gym tryouts can be tagged automatically."}
          </p>
        </div>
        {activeSeason ? <Badge variant="dark">Season {activeSeason.seasonNumber}</Badge> : null}
      </section>

      <section className="surface-card panel-pad settings-section">
        <div className="manage-gym-card-header">
          <div>
            <span className="metric-label">Manage season</span>
            <h2>{draft.seasonId ? "Edit Season" : "New Season"}</h2>
          </div>
          {draft.seasonId ? (
            <Button type="button" variant="secondary" size="sm" leadingIcon={<Plus size={16} />} onClick={resetDraft}>
              New Season
            </Button>
          ) : null}
        </div>

        {notice ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}

        <form className="gym-season-form" onSubmit={submitSeason}>
          <Input
            id="gym-season-number"
            label="Season number"
            type="number"
            min={1}
            value={draft.seasonNumber}
            onChange={(event) => setDraft((current) => ({ ...current, seasonNumber: event.target.value }))}
            required
          />
          <Input
            id="gym-season-label"
            label="Label"
            value={draft.label}
            placeholder={`Season ${draft.seasonNumber || "1"}`}
            onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))}
          />
          <Input
            id="gym-season-start"
            label="Start date"
            type="date"
            value={draft.startDate}
            onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
            required
          />
          <Input
            id="gym-season-end"
            label="End date"
            type="date"
            value={draft.endDate}
            onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
            required
          />
          <Select
            id="gym-season-status"
            label="Status"
            value={draft.status}
            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as GymSeasonStatus }))}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <div className="gym-season-form__actions">
            <Button type="submit" leadingIcon={draft.seasonId ? <Pencil size={16} /> : <CalendarDays size={16} />} disabled={submitting}>
              {submitting ? "Saving..." : draft.seasonId ? "Save Season" : "Create Season"}
            </Button>
          </div>
        </form>
      </section>

      <section className="surface-card panel-pad settings-section">
        <div className="manage-gym-card-header">
          <div>
            <span className="metric-label">Season history</span>
            <h2>Seasons</h2>
          </div>
        </div>
        <div className="settings-data-table-wrap">
          <table className="settings-data-table gym-seasons-table">
            <thead>
              <tr>
                <th scope="col">Season</th>
                <th scope="col">Dates</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {seasons.length ? seasons.map((season) => (
                <tr key={season.id}>
                  <td>
                    <strong>{season.label}</strong>
                    <span>#{season.seasonNumber}</span>
                  </td>
                  <td>{formatDate(season.startDate)} - {formatDate(season.endDate)}</td>
                  <td><Badge variant={statusBadgeVariant(season.status)}>{season.status}</Badge></td>
                  <td>
                    <Button type="button" variant="ghost" size="sm" leadingIcon={<Pencil size={15} />} onClick={() => setDraft(createDraftFromSeason(season))}>
                      Edit
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4}>No seasons configured yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
