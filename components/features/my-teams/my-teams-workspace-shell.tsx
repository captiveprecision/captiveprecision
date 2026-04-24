"use client";

import { Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MyTeamsSurface } from "@/components/features/cheer-planner/my-teams/my-teams-surface";
import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Tabs, Textarea } from "@/components/ui";
import type { PlannerTrashItem, RestorePreview } from "@/lib/domain/planner-versioning";
import type { AthleteDraftState } from "@/lib/services/planner-integration";
import type { LinkedCoachOption } from "@/lib/services/team-coach-directory";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";

type MyTeamsTab = "teams" | "athletes" | "trash";
type TrashFilter = "all" | "athlete" | "team";

type ComparableAthleteDraft = {
  registrationNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  notes: string;
  parentContacts: Array<{
    name: string;
    email: string;
    phone: string;
  }>;
};

type DeleteTarget =
  | { type: "athlete"; id: string; name: string }
  | { type: "team"; id: string; name: string }
  | null;

const TRASH_FILTER_TABS: Array<{ value: TrashFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "athlete", label: "Athletes" },
  { value: "team", label: "Teams" }
];

function buildComparableAthleteDraft(draft: Pick<AthleteDraftState, "registrationNumber" | "firstName" | "lastName" | "dateOfBirth" | "notes" | "parentContacts">): ComparableAthleteDraft {
  return {
    registrationNumber: draft.registrationNumber,
    firstName: draft.firstName,
    lastName: draft.lastName,
    dateOfBirth: draft.dateOfBirth,
    notes: draft.notes,
    parentContacts: draft.parentContacts.map((contact) => ({
      name: contact.name,
      email: contact.email,
      phone: contact.phone
    }))
  };
}

function buildEmptyComparableAthleteDraft(): ComparableAthleteDraft {
  return {
    registrationNumber: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    notes: "",
    parentContacts: [{ name: "", email: "", phone: "" }]
  };
}

function areComparableAthleteDraftsEqual(left: ComparableAthleteDraft, right: ComparableAthleteDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function formatTrashDate(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : parsed.toLocaleDateString("en-US");
}

function buildTrashSearchText(item: PlannerTrashItem) {
  const snapshot = item.snapshot && typeof item.snapshot === "object" && !Array.isArray(item.snapshot)
    ? item.snapshot as Record<string, unknown>
    : {};
  const parentContacts = Array.isArray(snapshot.parent_contacts)
    ? snapshot.parent_contacts
    : Array.isArray((snapshot.metadata as Record<string, unknown> | undefined)?.parentContacts)
      ? (snapshot.metadata as { parentContacts: unknown[] }).parentContacts
      : [];
  const parentText = parentContacts
    .flatMap((contact) => {
      if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
        return [];
      }

      const record = contact as Record<string, unknown>;
      return [
        typeof record.name === "string" ? record.name : "",
        typeof record.email === "string" ? record.email : ""
      ];
    })
    .join(" ");

  return [
    item.name,
    item.secondaryLabel,
    parentText
  ].join(" ").toLowerCase();
}

function RestoreDialog({
  item,
  preview,
  error,
  open,
  loading,
  restoring,
  onClose,
  onConfirm
}: {
  item: PlannerTrashItem | null;
  preview: RestorePreview | null;
  error: string | null;
  open: boolean;
  loading: boolean;
  restoring: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !item) {
    return null;
  }

  return (
    <div className="planner-modal-backdrop" role="presentation" onClick={restoring ? undefined : onClose}>
      <div
        className="planner-modal planner-modal--danger"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-restore-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="planner-modal__header">
          <span className="planner-modal__eyebrow">Trash</span>
          <h2 id="planner-restore-modal-title">Restore {item.name}</h2>
          <p>
            {preview?.secondaryLabel || item.secondaryLabel || (item.entityType === "athlete" ? "Athlete record" : "Team record")}
          </p>
        </div>

        {loading ? (
          <div className="planner-modal__body planner-modal__body--loading">
            <p className="planner-modal__loading-copy">Loading restore preview...</p>
          </div>
        ) : error ? (
          <div className="planner-modal__body">
            <p>{error}</p>
          </div>
        ) : (
          <div className="planner-modal__body planner-panel-stack">
            <div className="planner-summary-list">
              <div className="planner-summary-row">
                <strong>Deleted</strong>
                <span>{formatTrashDate(preview?.deletedAt ?? item.deletedAt)}</span>
              </div>
              <div className="planner-summary-row">
                <strong>Available Until</strong>
                <span>{formatTrashDate(preview?.expiresAt ?? item.expiresAt)}</span>
              </div>
              <div className="planner-summary-row">
                <strong>Restore Version</strong>
                <span>Version {preview?.versionNumber ?? "Unknown"}</span>
              </div>
            </div>

            {preview?.relatedRestores?.length ? (
              <div className="planner-trash-preview-block">
                <strong>Also Coming Back</strong>
                <div className="planner-trash-preview-list">
                  {preview.relatedRestores.map((entry) => (
                    <div key={entry.key} className="planner-summary-row">
                      <span>{entry.label}</span>
                      <span>{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {preview?.notes?.length ? (
              <div className="planner-trash-preview-block">
                <strong>Before You Restore</strong>
                <div className="planner-trash-preview-notes">
                  {preview.notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div className="planner-modal__actions">
          <Button type="button" variant="secondary" size="sm" leadingIcon={<X size={16} />} onClick={onClose} disabled={restoring}>
            Cancel
          </Button>
          <Button type="button" size="sm" leadingIcon={<RotateCcw size={16} />} onClick={onConfirm} disabled={loading || restoring || Boolean(error)}>
            {restoring ? "Restoring..." : "Restore"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteDialog({
  target,
  open,
  deleting,
  onClose,
  onConfirm
}: {
  target: DeleteTarget;
  open: boolean;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open || !target) {
    return null;
  }

  const isAthlete = target.type === "athlete";

  return (
    <div className="planner-modal-backdrop" role="presentation" onClick={deleting ? undefined : onClose}>
      <div
        className="planner-modal planner-modal--danger"
        role="dialog"
        aria-modal="true"
        aria-labelledby="planner-delete-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="planner-modal__header">
          <span className="planner-modal__eyebrow">{isAthlete ? "Delete Athlete" : "Delete Team"}</span>
          <h2 id="planner-delete-modal-title">{target.name}</h2>
          <p>
            {isAthlete
              ? "This athlete will be removed from the active workspace and hidden from normal views. You can recover it from Trash for 90 days."
              : "This team will be removed from the active workspace. Its roster links and planner plans will also leave the normal flow, and you can recover them from Trash for 90 days."}
          </p>
        </div>

        <div className="planner-modal__actions">
          <Button type="button" size="sm" leadingIcon={<X size={16} />} onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<Trash2 size={16} />}
            className="planner-modal__destructive-ghost"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : isAthlete ? "Delete Athlete" : "Delete Team"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MyTeamsWorkspaceShell({ coachOptions }: { coachOptions: LinkedCoachOption[] }) {
  const integration = useCheerPlannerIntegration("coach");
  const { loadTrash } = integration;
  const [tab, setTab] = useState<MyTeamsTab>("teams");
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [athleteDraftBaseline, setAthleteDraftBaseline] = useState<ComparableAthleteDraft>(buildEmptyComparableAthleteDraft());
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [restoreTarget, setRestoreTarget] = useState<PlannerTrashItem | null>(null);
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restorePreviewLoading, setRestorePreviewLoading] = useState(false);
  const [restorePreviewError, setRestorePreviewError] = useState<string | null>(null);
  const [trashFilter, setTrashFilter] = useState<TrashFilter>("all");
  const [trashQuery, setTrashQuery] = useState("");

  const isAthleteFormOpen = createAthleteOpen || Boolean(editingAthleteId);
  const hasUnsavedAthleteChanges = useMemo(() => (
    isAthleteFormOpen
    && !areComparableAthleteDraftsEqual(athleteDraftBaseline, buildComparableAthleteDraft(integration.athleteDraft))
  ), [athleteDraftBaseline, integration.athleteDraft, isAthleteFormOpen]);

  useEffect(() => {
    if (tab === "trash") {
      void loadTrash().catch(() => undefined);
    }
  }, [loadTrash, tab]);

  const filteredTrashItems = useMemo(() => {
    const normalizedQuery = trashQuery.trim().toLowerCase();

    return integration.trashItems.filter((item) => {
      if (trashFilter !== "all" && item.entityType !== trashFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return buildTrashSearchText(item).includes(normalizedQuery);
    });
  }, [integration.trashItems, trashFilter, trashQuery]);

  const myTeamsTabs = useMemo<Array<{ value: MyTeamsTab; label: string }>>(() => [
    { value: "teams", label: "Teams" },
    { value: "athletes", label: "Athletes" },
    { value: "trash", label: `Trash (${integration.trashItems.length})` }
  ], [integration.trashItems.length]);

  const confirmDiscardAthleteChanges = () => {
    if (!hasUnsavedAthleteChanges) {
      return true;
    }

    return window.confirm("You have unsaved athlete changes. Save the current record before moving on, or confirm to discard this draft.");
  };

  const resetAthleteEditor = () => {
    setCreateAthleteOpen(false);
    setEditingAthleteId(null);
  };

  const resetRestoreDialog = () => {
    setRestoreTarget(null);
    setRestorePreview(null);
    setRestorePreviewError(null);
    setRestorePreviewLoading(false);
  };

  const openCreateAthlete = () => {
    if (!confirmDiscardAthleteChanges()) {
      return;
    }

    integration.startNewAthlete();
    setAthleteDraftBaseline(buildEmptyComparableAthleteDraft());
    setEditingAthleteId(null);
    setCreateAthleteOpen(true);
  };

  const openEditAthlete = (athleteId: string) => {
    if (!confirmDiscardAthleteChanges()) {
      return;
    }

    const athlete = integration.athletePool.find((currentAthlete) => currentAthlete.id === athleteId) ?? null;

    if (!athlete) {
      return;
    }

    integration.loadRegisteredAthlete(athleteId);
    setAthleteDraftBaseline(buildComparableAthleteDraft({
      registrationNumber: athlete.registrationNumber,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      dateOfBirth: athlete.dateOfBirth,
      notes: athlete.notes,
      parentContacts: athlete.parentContacts
    }));
    setEditingAthleteId(athleteId);
    setCreateAthleteOpen(false);
  };

  const closeAthleteForm = () => {
    if (!confirmDiscardAthleteChanges()) {
      return;
    }

    resetAthleteEditor();
  };

  const handleSaveAthlete = async () => {
    const saved = await integration.saveAthleteProfile();

    if (!saved) {
      return;
    }

    integration.resetAthleteDraft();
    setAthleteDraftBaseline(buildEmptyComparableAthleteDraft());
    resetAthleteEditor();
  };

  const requestDeleteAthlete = (athleteId: string) => {
    const athlete = integration.athletePool.find((item) => item.id === athleteId) ?? null;

    if (!athlete) {
      return;
    }

    setDeleteTarget({
      type: "athlete",
      id: athlete.id,
      name: athlete.name
    });
  };

  const requestDeleteTeam = (teamId: string) => {
    const team = integration.myTeamsSummaries.find((item) => item.teamId === teamId) ?? null;

    if (!team) {
      return;
    }

    setDeleteTarget({
      type: "team",
      id: team.teamId,
      name: team.teamName
    });
  };

  const confirmDeleteTarget = async () => {
    if (!deleteTarget) {
      return;
    }

    if (deleteTarget.type === "athlete") {
      const deleted = await integration.deleteAthleteProfile(deleteTarget.id);

      if (deleted) {
        if (editingAthleteId === deleteTarget.id) {
          integration.resetAthleteDraft();
          setAthleteDraftBaseline(buildEmptyComparableAthleteDraft());
          resetAthleteEditor();
        }

        setDeleteTarget(null);
      }

      return;
    }

    const deleted = await integration.deleteTeam(deleteTarget.id);

    if (deleted) {
      setDeleteTarget(null);
    }
  };

  const openRestorePreview = async (item: PlannerTrashItem) => {
    setRestoreTarget(item);
    setRestorePreview(null);
    setRestorePreviewError(null);
    setRestorePreviewLoading(true);

    try {
      const preview = await integration.getTrashRestorePreview(item);
      setRestorePreview(preview);
    } catch (error) {
      setRestorePreviewError(error instanceof Error ? error.message : "Unable to load restore preview.");
    } finally {
      setRestorePreviewLoading(false);
    }
  };

  const confirmRestoreTarget = async () => {
    if (!restoreTarget) {
      return;
    }

    const restored = await integration.restoreTrashItem(restoreTarget);

    if (restored) {
      resetRestoreDialog();
    }
  };

  return (
    <main className="workspace-shell page-stack myteams-shell">
      <Card radius="panel" variant="subtle">
        <CardContent className="planner-panel-stack myteams-hero-card">
          <SectionHeader
            className="myteams-hero-header"
            eyebrow="My Teams"
            title="Manage Teams And Athlete Records"
            description="Work outside the live planner flow without losing team structure, athlete records, or recovery history."
          />

          <div className="planner-panel-stack myteams-hero-controls">
            <Tabs
              className="planner-workspace-switch myteams-switch"
              items={myTeamsTabs}
              value={tab}
              onValueChange={(value) => {
                if (value === tab) {
                  return;
                }

                if (tab === "athletes" && !confirmDiscardAthleteChanges()) {
                  return;
                }

                if (tab === "athletes") {
                  resetAthleteEditor();
                }

                if (value === "trash") {
                  void loadTrash().catch(() => undefined);
                }

                setTab(value);
              }}
              ariaLabel="My Teams Workspace"
            />
            {integration.saveMessage ? <Badge variant="accent">{integration.saveMessage}</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {tab === "teams" ? (
        <MyTeamsSurface
          teams={integration.myTeamsSummaries}
          coachOptions={coachOptions}
          saveMyTeamsTeamProfile={integration.saveMyTeamsTeamProfile}
          updateMyTeamsTeamProfile={integration.updateMyTeamsTeamProfile}
          requestDeleteTeam={requestDeleteTeam}
          deletingTeamId={integration.isSavingAction("team-delete") && deleteTarget?.type === "team" ? deleteTarget.id : null}
        />
      ) : null}

      {tab === "athletes" ? (
          <Card radius="panel" className="planner-panel-stack">
            <CardContent className="planner-panel-stack">
              <SectionHeader
                className="myteams-header"
                title="Manage Athletes"
                description="Register athletes here, then search them directly from Tryouts when coaches are ready to evaluate."
                actions={(
                  <Button type="button" onClick={openCreateAthlete} leadingIcon={<Plus size={16} />}>
                    Add Athlete
                </Button>
              )}
            />

            {isAthleteFormOpen ? (
              <Card variant="subtle" className="planner-create-athlete-card">
                <CardContent className="planner-panel-stack">
                  <SectionHeader
                    eyebrow={editingAthleteId ? "Edit Athlete" : "New Athlete"}
                    title={editingAthleteId ? "Update Athlete Record" : "Create Athlete Record"}
                  />
                  <div className="planner-athlete-grid">
                    <Input label="Registration #" value={integration.athleteDraft.registrationNumber || "Auto-assigned on Save"} readOnly />
                    <Input
                      label="First Name"
                      value={integration.athleteDraft.firstName}
                      onChange={(event) => integration.updateAthleteDraft("firstName", event.target.value)}
                    />
                    <Input
                      label="Last Name"
                      value={integration.athleteDraft.lastName}
                      onChange={(event) => integration.updateAthleteDraft("lastName", event.target.value)}
                    />
                    <Input
                      type="date"
                      label="Date Of Birth"
                      value={integration.athleteDraft.dateOfBirth}
                      onChange={(event) => integration.updateAthleteDraft("dateOfBirth", event.target.value)}
                    />
                    <Textarea
                      label="Notes"
                      rows={3}
                      containerClassName="planner-athlete-grid-wide"
                      value={integration.athleteDraft.notes}
                      onChange={(event) => integration.updateAthleteDraft("notes", event.target.value)}
                    />
                  </div>

                  <div className="planner-athlete-parent-stack">
                    <SectionHeader
                      eyebrow="Parents"
                      title="Parent Or Guardian Contacts"
                      actions={(
                        <Button type="button" variant="ghost" size="sm" onClick={integration.addParentContact}>
                          Add Contact
                        </Button>
                      )}
                    />
                    {integration.athleteDraft.parentContacts.map((contact, index) => (
                      <Card key={contact.id} variant="subtle" className="planner-parent-contact-card">
                        <CardContent className="planner-panel-stack">
                          <div className="planner-inline-actions planner-parent-contact-card__head">
                            <strong>Contact {index + 1}</strong>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              leadingIcon={<Trash2 />}
                              onClick={() => integration.removeParentContact(contact.id)}
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="planner-athlete-grid">
                            <Input
                              label="Parent Name"
                              value={contact.name}
                              onChange={(event) => integration.updateParentContact(contact.id, "name", event.target.value)}
                            />
                            <Input
                              label="Parent Email"
                              type="email"
                              value={contact.email}
                              onChange={(event) => integration.updateParentContact(contact.id, "email", event.target.value)}
                            />
                            <Input
                              label="Parent Phone"
                              value={contact.phone}
                              onChange={(event) => integration.updateParentContact(contact.id, "phone", event.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="planner-inline-actions">
                    <Button type="button" onClick={() => void handleSaveAthlete()}>
                      Save Athlete
                    </Button>
                    <Button type="button" variant="secondary" onClick={closeAthleteForm}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

              <div className="planner-athlete-pool-list">
                {integration.athletePool.length ? integration.athletePool.map((athlete) => (
                  <Card key={athlete.id} variant="subtle" className="planner-athlete-pool-row">
                    <CardContent className="planner-panel-stack">
                      <div className="planner-athlete-pool-row__content myteams-athlete-card-head">
                        <div className="planner-athlete-pool-copy myteams-athlete-card-head__copy">
                        <div className="planner-athlete-pool-title-row">
                          <strong>{athlete.name}</strong>
                          <Badge variant={athlete.displayLevel === "Unqualified" ? "subtle" : "dark"}>{athlete.displayLevel}</Badge>
                        </div>
                        <p>{athlete.registrationNumber} / Age {athlete.age ?? "-"} / Parent {athlete.parentContacts[0]?.name || "No Parent Contact Yet"}</p>
                        <div className="myteams-team-summary-compact">
                          <span className="myteams-team-summary-compact__eyebrow">Athlete Summary</span>
                          <span>
                            Latest Score {integration.formatScore(athlete.displayScore)} / Extra {integration.formatScore(athlete.extraScore)} / Team {athlete.assignedTeamName}
                          </span>
                        </div>
                        </div>
                        <div className="planner-athlete-row-actions myteams-athlete-row-actions">
                          <Button type="button" variant="ghost" size="sm" leadingIcon={<Pencil size={16} />} onClick={() => openEditAthlete(athlete.id)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Trash2 size={16} />}
                            disabled={integration.isSavingAction("athlete-delete") && deleteTarget?.type === "athlete" && deleteTarget.id === athlete.id}
                            onClick={() => requestDeleteAthlete(athlete.id)}
                          >
                            {integration.isSavingAction("athlete-delete") && deleteTarget?.type === "athlete" && deleteTarget.id === athlete.id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                <EmptyState title="No Athletes Saved Yet." description="Register athletes here and they will be available immediately in Tryouts and Team Builder." />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === "trash" ? (
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader
              eyebrow="Trash"
              title="Deleted Records"
              description="Deleted athletes and teams stay here for 90 days before leaving self-service recovery."
              actions={(
                <Button type="button" variant="secondary" onClick={() => void loadTrash().catch(() => undefined)} disabled={integration.trashLoading}>
                  {integration.trashLoading ? "Refreshing..." : "Refresh"}
                </Button>
              )}
            />

            <div className="planner-trash-toolbar">
              <Input
                label="Search Trash"
                value={trashQuery}
                onChange={(event) => setTrashQuery(event.target.value)}
                placeholder="Search by name, registration, parent, or team"
              />
              <Tabs
                className="planner-trash-filter-tabs"
                items={TRASH_FILTER_TABS}
                value={trashFilter}
                onValueChange={setTrashFilter}
                ariaLabel="Trash filters"
              />
            </div>

            <div className="planner-trash-list">
              {filteredTrashItems.length ? filteredTrashItems.map((item) => (
                <Card key={`${item.entityType}:${item.entityId}:${item.versionId}`} variant="subtle" className="planner-trash-row">
                  <CardContent className="planner-trash-row__content">
                    <div className="planner-trash-row__copy">
                      <div className="planner-trash-row__title">
                        <strong>{item.name}</strong>
                        <Badge variant={item.entityType === "athlete" ? "dark" : "subtle"}>
                          {item.entityType === "athlete" ? "Athlete" : "Team"}
                        </Badge>
                      </div>
                      <p>{item.secondaryLabel || (item.entityType === "athlete" ? "No registration saved" : "No team summary saved")}</p>
                      <p>
                        Deleted {formatTrashDate(item.deletedAt)}
                        {item.deletedByName ? ` by ${item.deletedByName}` : ""}
                        {" / "}
                        Available until {formatTrashDate(item.expiresAt)}
                      </p>
                    </div>
                    <div className="planner-trash-row__actions">
                      <Button
                        type="button"
                        size="sm"
                        leadingIcon={<RotateCcw />}
                        disabled={!item.restoreAvailable}
                        onClick={() => void openRestorePreview(item)}
                      >
                        Restore
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <EmptyState
                  title={integration.trashLoading ? "Loading Trash..." : "Trash Is Empty."}
                  description={integration.trashLoading ? "We are loading deleted records now." : "Deleted athletes and teams will appear here while they are still restorable."}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DeleteDialog
        target={deleteTarget}
        open={Boolean(deleteTarget)}
        deleting={
          (deleteTarget?.type === "athlete" && integration.isSavingAction("athlete-delete"))
          || (deleteTarget?.type === "team" && integration.isSavingAction("team-delete"))
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTarget()}
      />

      <RestoreDialog
        item={restoreTarget}
        preview={restorePreview}
        error={restorePreviewError}
        open={Boolean(restoreTarget)}
        loading={restorePreviewLoading}
        restoring={integration.isSavingAction("trash-restore")}
        onClose={resetRestoreDialog}
        onConfirm={() => void confirmRestoreTarget()}
      />
    </main>
  );
}
