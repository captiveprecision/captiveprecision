"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ellipsis, ListChecks, Pencil, Trash2, X } from "lucide-react";

import { LEVEL_LABELS } from "@/lib/domain/planner-levels";
import { Button, Input, Select } from "@/components/ui";

export type ManageGymCoachOption = {
  id: string;
  name: string;
  role: string;
};

export type ManageGymTeamAthleteScore = {
  id: string;
  name: string;
  registrationNumber: string;
  scoreLabel: string;
  qualifiedLevel: string;
  lastEvaluatedAt: string;
};

export type ManageGymTeamRow = {
  id: string;
  name: string;
  athleteCount: number;
  coachNames: string;
  coachIds: string[];
  level: string;
  category: string;
  athletes: ManageGymTeamAthleteScore[];
};

type ManageGymTeamsTableProps = {
  initialTeams: ManageGymTeamRow[];
  coachOptions: ManageGymCoachOption[];
  canManageTeams: boolean;
};

export function ManageGymTeamsTable({ initialTeams, coachOptions, canManageTeams }: ManageGymTeamsTableProps) {
  const router = useRouter();
  const [teams, setTeams] = useState(initialTeams);
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<ManageGymTeamRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ManageGymTeamRow | null>(null);
  const [athleteScoreTarget, setAthleteScoreTarget] = useState<ManageGymTeamRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCoachIds, setEditCoachIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setTeams(initialTeams);
  }, [initialTeams]);

  function toggleExpandedTeam(id: string) {
    setExpandedTeamIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openEdit(team: ManageGymTeamRow) {
    setEditTarget(team);
    setEditName(team.name);
    setEditLevel(team.level === "Not set" ? "" : team.level);
    setEditCategory(team.category === "Not set" ? "" : team.category);
    setEditCoachIds(team.coachIds);
    setNotice(null);
  }

  function toggleCoach(coachId: string) {
    setEditCoachIds((current) => (
      current.includes(coachId)
        ? current.filter((id) => id !== coachId)
        : [...current, coachId]
    ));
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/gym/teams", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          teamId: editTarget.id,
          name: editName,
          level: editLevel,
          category: editCategory,
          coachIds: editCoachIds
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to update team.");
      }

      const coachNames = Array.isArray(payload.coachNames) && payload.coachNames.length
        ? payload.coachNames.join(", ")
        : "No coaches assigned";
      const nextCoachIds = Array.isArray(payload.coachIds)
        ? payload.coachIds.filter((id: unknown): id is string => typeof id === "string")
        : editCoachIds;

      setTeams((current) => current.map((team) => (
        team.id === editTarget.id
          ? {
            ...team,
            name: editName,
            level: editLevel || "Not set",
            category: editCategory || "Not set",
            coachIds: nextCoachIds,
            coachNames
          }
          : team
      )));
      setNotice({ type: "success", message: payload.message ?? "Team updated." });
      setEditTarget(null);
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update team." });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/gym/teams", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ teamId: removeTarget.id })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to remove team.");
      }

      setTeams((current) => current.filter((team) => team.id !== removeTarget.id));
      setExpandedTeamIds((current) => {
        const next = new Set(current);
        next.delete(removeTarget.id);
        return next;
      });
      setNotice({ type: "success", message: payload.message ?? "Team removed." });
      setRemoveTarget(null);
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to remove team." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="manage-gym-card-header">
        <div>
          <div className="metric-label">Teams</div>
        </div>
      </div>

      {notice ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}

      <div className="settings-data-table-wrap">
        <table className="settings-data-table manage-gym-teams-table">
          <thead>
            <tr>
              <th scope="col">Team Name</th>
              <th scope="col">Level</th>
              <th scope="col">Athletes</th>
              <th scope="col">Coaches</th>
            </tr>
          </thead>
          <tbody>
            {teams.length ? (
              teams.map((team) => (
                <ManageGymTeamTableRow
                  key={team.id}
                  team={team}
                  isExpanded={expandedTeamIds.has(team.id)}
                  canManageTeams={canManageTeams}
                  onToggleExpanded={toggleExpandedTeam}
                  onEdit={openEdit}
                  onRemove={setRemoveTarget}
                  onOpenAthleteScores={setAthleteScoreTarget}
                />
              ))
            ) : (
              <tr>
                <td colSpan={4}>No teams found for this gym.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !submitting && setEditTarget(null)}>
          <form className="admin-account-modal manage-gym-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-team-edit-title" onSubmit={submitEdit} onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Team settings</span>
                <h2 id="manage-gym-team-edit-title">Edit {editTarget.name}</h2>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close team edit form" onClick={() => setEditTarget(null)} disabled={submitting}>
                <X size={18} />
              </Button>
            </div>

            <Input id="manage-gym-team-name" label="Team name" value={editName} onChange={(event) => setEditName(event.target.value)} required />
            <Select
              id="manage-gym-team-level"
              label="Level"
              value={editLevel}
              onChange={(event) => setEditLevel(event.target.value)}
              placeholder="Not set"
            >
              {LEVEL_LABELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </Select>
            <Input id="manage-gym-team-category" label="Category" value={editCategory} onChange={(event) => setEditCategory(event.target.value)} placeholder="Youth, Junior, Senior..." />
            <div className="manage-gym-compact-editor" role="group" aria-labelledby="manage-gym-team-coaches-label">
              <span id="manage-gym-team-coaches-label" className="ui-field__label">Coaches</span>
              <div className="manage-gym-compact-table">
                {coachOptions.length ? (
                  coachOptions.map((coach) => (
                    <label key={coach.id} className="manage-gym-compact-row">
                      <span>{coach.name}</span>
                      <small>{coach.role}</small>
                      <input
                        type="checkbox"
                        checked={editCoachIds.includes(coach.id)}
                        onChange={() => toggleCoach(coach.id)}
                      />
                    </label>
                  ))
                ) : (
                  <div className="manage-gym-compact-empty">No active coaches available.</div>
                )}
              </div>
            </div>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" leadingIcon={<Pencil size={16} />} disabled={submitting || !editName.trim()}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {athleteScoreTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => setAthleteScoreTarget(null)}>
          <div className="admin-account-modal manage-gym-action-modal manage-gym-athlete-scores-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-athlete-scores-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Team athletes</span>
                <h2 id="manage-gym-athlete-scores-title">{athleteScoreTarget.name}</h2>
                <p>{athleteScoreTarget.level} / {athleteScoreTarget.athleteCount} athlete(s)</p>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close athlete scores" onClick={() => setAthleteScoreTarget(null)}>
                <X size={18} />
              </Button>
            </div>

            <div className="settings-data-table-wrap">
              <table className="settings-data-table settings-data-table--compact manage-gym-athlete-scores-table">
                <thead>
                  <tr>
                    <th scope="col">Athlete</th>
                    <th scope="col">Registration</th>
                    <th scope="col">Score</th>
                    <th scope="col">Level</th>
                    <th scope="col">Last evaluation</th>
                  </tr>
                </thead>
                <tbody>
                  {athleteScoreTarget.athletes.length ? (
                    athleteScoreTarget.athletes.map((athlete) => (
                      <tr key={athlete.id}>
                        <td><strong>{athlete.name}</strong></td>
                        <td>{athlete.registrationNumber || "Not set"}</td>
                        <td>{athlete.scoreLabel}</td>
                        <td>{athlete.qualifiedLevel}</td>
                        <td>{athlete.lastEvaluatedAt}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>No athletes are currently assigned to this team.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setAthleteScoreTarget(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {removeTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !submitting && setRemoveTarget(null)}>
          <div className="admin-account-modal manage-gym-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-team-remove-title" onClick={(event) => event.stopPropagation()}>
            <div className="manage-gym-warning-head">
              <span className="manage-gym-warning-icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </span>
              <div>
                <span className="ui-section-header__eyebrow">Warning</span>
                <h2 id="manage-gym-team-remove-title">Remove {removeTarget.name}?</h2>
                <p>This will remove the team from active Gym management. Existing historical planner data remains recoverable from backend records.</p>
              </div>
            </div>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setRemoveTarget(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" leadingIcon={<Trash2 size={16} />} onClick={() => void confirmRemove()} disabled={submitting}>
                {submitting ? "Removing..." : "Remove Team"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ManageGymTeamTableRowProps = {
  team: ManageGymTeamRow;
  isExpanded: boolean;
  canManageTeams: boolean;
  onToggleExpanded: (id: string) => void;
  onEdit: (team: ManageGymTeamRow) => void;
  onRemove: (team: ManageGymTeamRow) => void;
  onOpenAthleteScores: (team: ManageGymTeamRow) => void;
};

function ManageGymTeamTableRow({
  team,
  isExpanded,
  canManageTeams,
  onToggleExpanded,
  onEdit,
  onRemove,
  onOpenAthleteScores
}: ManageGymTeamTableRowProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  return (
    <>
      <tr
        className="settings-data-table__expand-row"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpanded(team.id)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpanded(team.id);
          }
        }}
      >
        <td>
          <strong>{team.name}</strong>
        </td>
        <td>{team.level}</td>
        <td>{team.athleteCount}</td>
        <td>{team.coachNames}</td>
      </tr>
      {isExpanded ? (
        <tr className="settings-data-table__detail-row">
          <td colSpan={4}>
            <div className="manage-gym-person-details">
              {canManageTeams ? (
                <div className="manage-gym-person-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Open actions for ${team.name}`}
                    leadingIcon={<Ellipsis size={18} />}
                    onClick={() => setActionMenuOpen((value) => !value)}
                  />
                  {actionMenuOpen ? (
                    <div className="manage-gym-person-action-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false);
                          onEdit(team);
                        }}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="manage-gym-person-action-menu__danger"
                        onClick={() => {
                          setActionMenuOpen(false);
                          onRemove(team);
                        }}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="manage-gym-profile-row manage-gym-team-detail-grid">
                <div>
                  <span className="metric-label">Athletes</span>
                  <strong>{team.athleteCount}</strong>
                </div>
                <div>
                  <span className="metric-label">Level</span>
                  <strong>{team.level}</strong>
                </div>
                <div>
                  <span className="metric-label">Category</span>
                  <strong>{team.category}</strong>
                </div>
                <div>
                  <span className="metric-label">Coaches</span>
                  <strong>{team.coachNames}</strong>
                </div>
              </div>
              <div className="manage-gym-team-detail-footer">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leadingIcon={<ListChecks size={16} />}
                  onClick={() => onOpenAthleteScores(team)}
                >
                  View Athletes & Scores
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
