"use client";

import { useState } from "react";

import { MyTeamsSurface } from "@/components/features/cheer-planner/my-teams/my-teams-surface";
import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader, Tabs, Textarea } from "@/components/ui";
import type { LinkedCoachOption } from "@/lib/services/team-coach-directory";
import { useCheerPlannerIntegration } from "@/lib/services/planner-integration";

type MyTeamsTab = "teams" | "athletes";

const MY_TEAMS_TABS: Array<{ value: MyTeamsTab; label: string }> = [
  { value: "teams", label: "Teams" },
  { value: "athletes", label: "Athletes" }
];

export function MyTeamsWorkspaceShell({ coachOptions }: { coachOptions: LinkedCoachOption[] }) {
  const integration = useCheerPlannerIntegration("coach");
  const [tab, setTab] = useState<MyTeamsTab>("teams");
  const [createAthleteOpen, setCreateAthleteOpen] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);

  const openCreateAthlete = () => {
    integration.startNewAthlete();
    setEditingAthleteId(null);
    setCreateAthleteOpen(true);
  };

  const openEditAthlete = (athleteId: string) => {
    integration.loadRegisteredAthlete(athleteId);
    setEditingAthleteId(athleteId);
    setCreateAthleteOpen(false);
  };

  const closeAthleteForm = () => {
    setCreateAthleteOpen(false);
    setEditingAthleteId(null);
  };

  const handleSaveAthlete = async () => {
    const saved = await integration.saveAthleteProfile();

    if (!saved) {
      return;
    }

    setCreateAthleteOpen(false);
    setEditingAthleteId(integration.athleteDraft.athleteId);
  };

  const isAthleteFormOpen = createAthleteOpen || Boolean(editingAthleteId);

  return (
    <main className="workspace-shell page-stack myteams-shell">
      <Card radius="panel" variant="subtle">
        <CardContent className="planner-panel-stack myteams-hero-card">
          <SectionHeader
            eyebrow="My Teams"
            title="Manage teams and athlete records outside the planner flow."
          />

          <div className="planner-panel-stack myteams-hero-controls">
            <Tabs
              className="planner-workspace-switch myteams-switch"
              items={MY_TEAMS_TABS}
              value={tab}
              onValueChange={(value) => setTab(value)}
              ariaLabel="My teams workspace"
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
              title="Saved athlete records"
              description="Register athletes here, then search them directly from Tryouts when coaches are ready to evaluate."
              actions={
                <Button type="button" onClick={openCreateAthlete}>
                  Add athlete
                </Button>
              }
            />

            {isAthleteFormOpen ? (
              <Card variant="subtle" className="planner-create-athlete-card">
                <CardContent className="planner-panel-stack">
                  <SectionHeader
                    eyebrow={editingAthleteId ? "Edit athlete" : "New athlete"}
                    title={editingAthleteId ? "Update athlete registration" : "Register athlete"}
                  />
                  <div className="planner-athlete-grid">
                    <Input label="Registration #" value={integration.athleteDraft.registrationNumber || "Auto-assigned on save"} readOnly />
                    <Input
                      label="First name"
                      value={integration.athleteDraft.firstName}
                      onChange={(event) => integration.updateAthleteDraft("firstName", event.target.value)}
                    />
                    <Input
                      label="Last name"
                      value={integration.athleteDraft.lastName}
                      onChange={(event) => integration.updateAthleteDraft("lastName", event.target.value)}
                    />
                    <Input
                      type="date"
                      label="Date of birth"
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
                      title="Parent or guardian contacts"
                      actions={
                        <Button type="button" variant="ghost" size="sm" onClick={integration.addParentContact}>
                          Add contact
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
                              onClick={() => integration.removeParentContact(contact.id)}
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="planner-athlete-grid">
                            <Input
                              label="Parent name"
                              value={contact.name}
                              onChange={(event) => integration.updateParentContact(contact.id, "name", event.target.value)}
                            />
                            <Input
                              label="Parent email"
                              type="email"
                              value={contact.email}
                              onChange={(event) => integration.updateParentContact(contact.id, "email", event.target.value)}
                            />
                            <Input
                              label="Parent phone"
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
                      Save athlete
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
                      <p>{athlete.registrationNumber} / Age {athlete.age ?? "-"} / Parent {athlete.parentContacts[0]?.name || "No parent contact yet"}</p>
                      <p>Latest score {integration.formatScore(athlete.displayScore)} / Extra {integration.formatScore(athlete.extraScore)} / Team {athlete.assignedTeamName}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => openEditAthlete(athlete.id)}>
                      Edit
                    </Button>
                  </CardContent>
                </Card>
              )) : (
                <EmptyState title="No athletes saved yet." description="Register athletes here and they will be available immediately in Tryouts and Team Builder." />
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}



