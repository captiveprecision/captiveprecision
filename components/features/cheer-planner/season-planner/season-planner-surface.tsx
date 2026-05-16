"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Select, Textarea } from "@/components/ui";
import type { TeamSeasonManualEntry, TeamSeasonManualEntryType } from "@/lib/domain/season-plan";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

type SeasonPlannerSurfaceProps = {
  canEdit?: boolean;
  canEditManualEntries?: boolean;
  canEditTeam?: (teamId: string) => boolean;
  teams: CheerPlannerIntegration["seasonPlannerTeams"];
  seasonPlannerDraft: CheerPlannerIntegration["seasonPlannerDraft"];
  openSeasonPlannerTeam: (teamId: string) => void;
  cancelSeasonPlannerEdit: () => void;
  toggleSeasonPlannerCheckpoint: (checkpointId: string) => void;
  updateSeasonPlannerCheckpoint: (checkpointId: string, field: "targetDate" | "status" | "notes", value: string) => void;
  addSeasonPlannerManualEntry: (entryType: TeamSeasonManualEntryType) => void;
  updateSeasonPlannerManualEntry: (entryId: string, field: "type" | "title" | "targetDate" | "status" | "notes", value: string) => void;
  removeSeasonPlannerManualEntry: (entryId: string) => void;
  saveSeasonPlannerEdit: () => void;
  isSavingAction: (actionKey: string) => boolean;
};

const MANUAL_ENTRY_TYPES: Array<{ value: TeamSeasonManualEntryType; label: string }> = [
  { value: "evaluation", label: "Evaluation" },
  { value: "choreography", label: "Choreography" },
  { value: "event", label: "Event" }
];

function getManualEntryTypeLabel(type: TeamSeasonManualEntry["type"]) {
  return MANUAL_ENTRY_TYPES.find((entryType) => entryType.value === type)?.label ?? "Evaluation";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "No Target Date";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US");
}

export function SeasonPlannerSurface(props: SeasonPlannerSurfaceProps) {
  const {
    canEdit = true,
    canEditManualEntries = true,
    canEditTeam = () => true,
    teams,
    seasonPlannerDraft,
    openSeasonPlannerTeam,
    cancelSeasonPlannerEdit,
    toggleSeasonPlannerCheckpoint,
    updateSeasonPlannerCheckpoint,
    addSeasonPlannerManualEntry,
    updateSeasonPlannerManualEntry,
    removeSeasonPlannerManualEntry,
    saveSeasonPlannerEdit,
    isSavingAction
  } = props;

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Season Planner"
            title="Team Season Checkpoints"
            description="Track season progress by team. Dated checkpoints and manual entries are published into Events, which is the operational calendar for the gym and coaches."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = seasonPlannerDraft?.teamId === team.teamId;
              const selectedCount = isEditing
                ? seasonPlannerDraft.checkpoints.filter((checkpoint) => checkpoint.selected).length
                : (team.seasonPlan?.checkpoints.length ?? 0);
              const persistedManualEntries = team.seasonPlan?.manualEntries ?? [];
              const teamCanEdit = canEdit && canEditTeam(team.teamId);
              const teamCanEditManualEntries = teamCanEdit && canEditManualEntries;

              return (
                <Card key={team.teamId} variant="subtle" className="planner-team-card">
                  <CardContent className="planner-panel-stack">
                    <div className="planner-team-card-head">
                      <div>
                        <strong>{team.teamName}</strong>
                        <p>{team.teamLevel} / {team.teamType}</p>
                      </div>
                      <div className="planner-team-card-actions">
                        <div className="planner-summary-chip-group">
                          <Badge variant={team.routinePlan ? "accent" : "subtle"}>{team.routinePlan ? `Routine ${team.routinePlan.status.charAt(0).toUpperCase()}${team.routinePlan.status.slice(1)}` : "No Routine"}</Badge>
                          <Badge variant={team.seasonPlan ? "dark" : "subtle"}>{team.seasonPlan ? `Season ${team.seasonPlan.status.charAt(0).toUpperCase()}${team.seasonPlan.status.slice(1)}` : "No Season Plan"}</Badge>
                        </div>
                        {isEditing && teamCanEdit ? (
                          <>
                            <Button size="sm" onClick={saveSeasonPlannerEdit} disabled={isSavingAction("season-plan")}>
                              {isSavingAction("season-plan") ? "Saving..." : "Save"}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={cancelSeasonPlannerEdit}>Cancel</Button>
                          </>
                        ) : teamCanEdit && (team.availableCheckpoints.length || teamCanEditManualEntries) ? (
                          <Button variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={() => openSeasonPlannerTeam(team.teamId)}>Edit team</Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{team.routineInput ? `${team.routineInput.itemCount} Routine Items / ${team.routineInput.approvedItemCount} Approved` : "No Routine Context"}</span>
                      <span>{team.seasonPlan?.checkpoints.length ?? 0} persisted / {selectedCount} current</span>
                    </div>

                    <div className="planner-team-members-list">
                      {isEditing ? (
                        seasonPlannerDraft.checkpoints.length ? seasonPlannerDraft.checkpoints.map((checkpoint) => (
                          <Card key={checkpoint.id} variant="subtle" className="planner-season-checkpoint-card">
                            <CardContent className="planner-panel-stack">
                              <label className="planner-team-member-row">
                                <div>
                                  <strong>{checkpoint.name}</strong>
                                  <p>{formatDate(checkpoint.targetDate)}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checkpoint.selected}
                                  disabled={!teamCanEdit}
                                  onChange={() => toggleSeasonPlannerCheckpoint(checkpoint.id)}
                                />
                              </label>
                              {checkpoint.selected ? (
                                <div className="planner-athlete-grid">
                                  <Input
                                    type="date"
                                    label="Completion Date"
                                    value={checkpoint.targetDate}
                                    disabled={!teamCanEdit}
                                    onChange={(event) => updateSeasonPlannerCheckpoint(checkpoint.id, "targetDate", event.target.value)}
                                  />
                                  <Select
                                    label="Status"
                                    value={checkpoint.status}
                                    disabled={!teamCanEdit}
                                    onChange={(event) => updateSeasonPlannerCheckpoint(checkpoint.id, "status", event.target.value)}
                                  >
                                    <option value="planned">Planned</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="completed">Completed</option>
                                  </Select>
                                  <Textarea
                                    label="Notes"
                                    rows={2}
                                    containerClassName="planner-athlete-grid-wide"
                                    value={checkpoint.notes}
                                    disabled={!teamCanEdit}
                                    onChange={(event) => updateSeasonPlannerCheckpoint(checkpoint.id, "notes", event.target.value)}
                                  />
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        )) : (
                          <EmptyState title="No Season Checkpoints Available." description="Season Planner depends on routine context or an existing season plan for this team." />
                        )
                      ) : team.availableCheckpoints.length ? team.availableCheckpoints.map((checkpoint) => (
                        <div key={checkpoint.id} className="planner-team-member-row">
                          <div>
                            <strong>{checkpoint.name}</strong>
                            <p>{formatDate(checkpoint.targetDate)}</p>
                          </div>
                        </div>
                      )) : (
                        <EmptyState title="No Season Checkpoints Available." description="Season Planner depends on routine context or an existing season plan for this team." />
                      )}
                    </div>

                    <div className="planner-panel-stack">
                      <SectionHeader
                        eyebrow="Timeline"
                        title="Manual Season Entries"
                        actions={isEditing && teamCanEditManualEntries ? (
                          <div className="planner-inline-actions">
                            {MANUAL_ENTRY_TYPES.map((entryType) => (
                              <Button
                                key={entryType.value}
                                type="button"
                                variant="secondary"
                                size="sm"
                                leadingIcon={<Plus />}
                                onClick={() => addSeasonPlannerManualEntry(entryType.value)}
                              >
                                {entryType.label}
                              </Button>
                            ))}
                          </div>
                        ) : undefined}
                      />
                      {isEditing ? (
                        seasonPlannerDraft.manualEntries.length ? seasonPlannerDraft.manualEntries.map((entry) => (
                          <Card key={entry.id} variant="subtle" className="planner-season-checkpoint-card">
                            <CardContent className="planner-panel-stack">
                              <div className="planner-athlete-grid">
                                <Select
                                  label="Type"
                                  value={entry.type}
                                  disabled={!teamCanEditManualEntries}
                                  onChange={(event) => updateSeasonPlannerManualEntry(entry.id, "type", event.target.value)}
                                >
                                  {MANUAL_ENTRY_TYPES.map((entryType) => (
                                    <option key={entryType.value} value={entryType.value}>{entryType.label}</option>
                                  ))}
                                </Select>
                                <Input
                                  label="Title"
                                  value={entry.title}
                                  disabled={!teamCanEditManualEntries}
                                  onChange={(event) => updateSeasonPlannerManualEntry(entry.id, "title", event.target.value)}
                                />
                                <Input
                                  type="date"
                                  label="Date"
                                  value={entry.targetDate ?? ""}
                                  disabled={!teamCanEditManualEntries}
                                  onChange={(event) => updateSeasonPlannerManualEntry(entry.id, "targetDate", event.target.value)}
                                />
                                <Select
                                  label="Status"
                                  value={entry.status}
                                  disabled={!teamCanEditManualEntries}
                                  onChange={(event) => updateSeasonPlannerManualEntry(entry.id, "status", event.target.value)}
                                >
                                  <option value="planned">Planned</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="completed">Completed</option>
                                </Select>
                                <Textarea
                                  label="Notes"
                                  rows={2}
                                  containerClassName="planner-athlete-grid-wide"
                                  value={entry.notes}
                                  disabled={!teamCanEditManualEntries}
                                  onChange={(event) => updateSeasonPlannerManualEntry(entry.id, "notes", event.target.value)}
                                />
                              </div>
                              {teamCanEditManualEntries ? (
                                <div className="planner-inline-actions">
                                  <Button type="button" variant="ghost" size="sm" leadingIcon={<Trash2 />} onClick={() => removeSeasonPlannerManualEntry(entry.id)}>
                                    Remove
                                  </Button>
                                </div>
                              ) : null}
                            </CardContent>
                          </Card>
                        )) : (
                          <EmptyState title="No Manual Entries Yet." description="Add dated evaluations, choreography notes, or events to publish them into Events for this team." />
                        )
                      ) : persistedManualEntries.length ? persistedManualEntries.map((entry) => (
                        <div key={entry.id} className="planner-team-member-row">
                          <div>
                            <strong>{entry.title || getManualEntryTypeLabel(entry.type)}</strong>
                            <p>
                              {getManualEntryTypeLabel(entry.type)}
                              {" / "}
                              {formatDate(entry.targetDate)}
                              {" / "}
                              {entry.status}
                            </p>
                            {entry.notes ? <p>{entry.notes}</p> : null}
                          </div>
                        </div>
                      )) : (
                        <EmptyState title="No Manual Entries Yet." description="Dated evaluations, choreography notes, and events will appear in Events after saving." />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No Teams Available Yet." description="Season Planner depends on the canonical team pipeline already stored in PlannerProject." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
