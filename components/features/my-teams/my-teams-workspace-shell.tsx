"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { MyTeamsSurface } from "@/components/features/cheer-planner/my-teams/my-teams-surface";
import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Tabs, Textarea } from "@/components/ui";
import type { AthleteDraftState } from "@/lib/services/planner-integration";
import type { LinkedCoachOption } from "@/lib/services/team-coach-directory";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";

type MyTeamsTab = "teams" | "athletes";

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

const MY_TEAMS_TABS: Array<{ value: MyTeamsTab; label: string }> = [
  { value: "teams", label: "Teams" },
  { value: "athletes", label: "Athletes" }
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

export function MyTeamsWorkspaceShell({ coachOptions }: { coachOptions: LinkedCoachOption[] }) {
  const integration = useCheerPlannerIntegration("coach");
  const [tab, setTab] = useState<MyTeamsTab>("teams");
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [athleteDraftBaseline, setAthleteDraftBaseline] = useState<ComparableAthleteDraft>(buildEmptyComparableAthleteDraft());

  const isAthleteFormOpen = createAthleteOpen || Boolean(editingAthleteId);
  const hasUnsavedAthleteChanges = useMemo(() => (
    isAthleteFormOpen
    && !areComparableAthleteDraftsEqual(athleteDraftBaseline, buildComparableAthleteDraft(integration.athleteDraft))
  ), [athleteDraftBaseline, integration.athleteDraft, isAthleteFormOpen]);

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

    setAthleteDraftBaseline(buildComparableAthleteDraft(integration.athleteDraft));
    resetAthleteEditor();
  };

  return (
    <main className="workspace-shell page-stack myteams-shell">
      <Card radius="panel" variant="subtle">
        <CardContent className="planner-panel-stack myteams-hero-card">
          <SectionHeader
            eyebrow="My Teams"
            title="Manage Teams And Athlete Records"
            description="Work outside the live planner flow without losing team structure or athlete records."
          />

          <div className="planner-panel-stack myteams-hero-controls">
            <Tabs
              className="planner-workspace-switch myteams-switch"
              items={MY_TEAMS_TABS}
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
        />
      ) : null}

      {tab === "athletes" ? (
        <Card radius="panel" className="planner-panel-stack">
          <CardContent className="planner-panel-stack">
            <SectionHeader
              eyebrow="Athletes"
              title="Saved Athlete Records"
              description="Register athletes here, then search them directly from Tryouts when coaches are ready to evaluate."
              actions={
                <Button type="button" onClick={openCreateAthlete}>
                  Add Athlete
                </Button>
              }
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
                      actions={
                        <Button type="button" variant="ghost" size="sm" onClick={integration.addParentContact}>
                          Add Contact
                        </Button>
                      }
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
                  <CardContent className="planner-athlete-pool-row__content">
                    <div className="planner-athlete-pool-copy">
                      <div className="planner-athlete-pool-title-row">
                        <strong>{athlete.name}</strong>
                        <Badge variant={athlete.displayLevel === "Unqualified" ? "subtle" : "dark"}>{athlete.displayLevel}</Badge>
                      </div>
                      <p>{athlete.registrationNumber} / Age {athlete.age ?? "-"} / Parent {athlete.parentContacts[0]?.name || "No Parent Contact Yet"}</p>
                      <p>Latest Score {integration.formatScore(athlete.displayScore)} / Extra {integration.formatScore(athlete.extraScore)} / Team {athlete.assignedTeamName}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" leadingIcon={<Pencil />} onClick={() => openEditAthlete(athlete.id)}>
                      Edit Record
                    </Button>
                  </CardContent>
                </Card>
              )) : (
                <EmptyState title="No Athletes Saved Yet." description="Register athletes here and they will be available immediately in Tryouts and Team Builder." />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}


