"use client";

import { useEffect, useState } from "react";

import { Badge, Button, Card, CardContent, EmptyState, Input, SectionHeader } from "@/components/ui";
import type { TeamSkillCategory, TeamSkillSelection } from "@/lib/domain/skill-plan";
import { SKILL_PLANNER_CATEGORY_CONFIG } from "@/lib/services/planner-skill-planner";
import type { CheerPlannerIntegration } from "@/lib/services/planner-integration";

const SKILL_LEVEL_OPTIONS = ["Elite", "Advanced", "Level Appropriate", "Below Level"] as const;

type SkillPlannerSurfaceProps = {
  teams: CheerPlannerIntegration["skillPlannerTeams"];
  skillPlannerDraft: CheerPlannerIntegration["skillPlannerDraft"];
  openSkillPlannerTeam: (teamId: string) => void;
  cancelSkillPlannerEdit: () => void;
  updateSkillPlannerSelection: (selectionId: string, field: "skillName" | "levelLabel", value: string) => void;
  addSkillPlannerSelection: (category: TeamSkillCategory, groupIndex?: number | null) => void;
  removeSkillPlannerSelection: (selectionId: string) => void;
  saveSkillPlannerEdit: () => void;
};

function groupSelectionsByCategory(selections: TeamSkillSelection[]) {
  return SKILL_PLANNER_CATEGORY_CONFIG.map((category) => {
    const categorySelections = selections.filter((selection) => selection.category === category.key);
    const groups = category.groupCount
      ? Array.from({ length: category.groupCount }, (_, groupOffset) => {
          const groupIndex = groupOffset + 1;
          return {
            groupIndex,
            groupLabel: `Structure ${groupIndex}`,
            selections: categorySelections
              .filter((selection) => selection.groupIndex === groupIndex)
              .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
          };
        })
      : [{
          groupIndex: null,
          groupLabel: null,
          selections: categorySelections
            .filter((selection) => selection.groupIndex === null)
            .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
        }];

    return {
      key: category.key,
      label: category.label,
      groups
    };
  });
}

function countSectionRows(sections: ReturnType<typeof groupSelectionsByCategory>) {
  return sections.reduce((sum, section) => sum + section.groups.reduce((groupSum, group) => groupSum + group.selections.length, 0), 0);
}

export function SkillPlannerSurface(props: SkillPlannerSurfaceProps) {
  const {
    teams,
    skillPlannerDraft,
    openSkillPlannerTeam,
    cancelSkillPlannerEdit,
    updateSkillPlannerSelection,
    addSkillPlannerSelection,
    removeSkillPlannerSelection,
    saveSkillPlannerEdit
  } = props;
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!teams.length) {
      setSelectedTeamId(null);
      return;
    }

    if (skillPlannerDraft?.teamId) {
      setSelectedTeamId(skillPlannerDraft.teamId);
      return;
    }

    setSelectedTeamId((current) => (
      current && teams.some((team) => team.teamId === current) ? current : null
    ));
  }, [skillPlannerDraft?.teamId, teams]);

  return (
    <div className="planner-team-builder-stack">
      <Card radius="panel" className="planner-panel-stack">
        <CardContent className="planner-panel-stack">
          <SectionHeader
            eyebrow="Skill Planner"
            title="Editable team skill structure"
            description="Select a team to review its saved skill plan. Use Edit team only when you are ready to change the rows that will flow into Routine Builder."
          />
          <div className="planner-team-card-list">
            {teams.length ? teams.map((team) => {
              const isEditing = skillPlannerDraft?.teamId === team.teamId;
              const isSelected = selectedTeamId === team.teamId;
              const draftSelections = isEditing ? skillPlannerDraft.selections : [];
              const persistedCount = team.existingPlan?.selections.filter((selection) => selection.skillName.trim().length > 0).length ?? 0;
              const currentCount = isEditing
                ? draftSelections.filter((selection) => selection.skillName.trim().length > 0).length
                : persistedCount;
              const sections = isEditing ? groupSelectionsByCategory(draftSelections) : team.sections;
              const sectionRowCount = sections.reduce((sum, section) => sum + section.groups.reduce((groupSum, group) => groupSum + group.selections.length, 0), 0);

              return (
                <Card key={team.teamId} variant="subtle" className="planner-team-card">
                  <CardContent className="planner-panel-stack">
                    <div className="planner-team-card-head">
                      <div>
                        <strong>{team.teamName}</strong>
                        <p>{team.teamLevel} / {team.teamType}</p>
                      </div>
                      <div className="planner-team-card-actions">
                        <Badge variant={team.existingPlan ? "accent" : "subtle"}>
                          {team.existingPlan ? `Plan ${team.existingPlan.status}` : "No plan"}
                        </Badge>
                        {isEditing ? (
                          <>
                            <Button size="sm" onClick={saveSkillPlannerEdit}>Save</Button>
                            <Button variant="secondary" size="sm" onClick={cancelSkillPlannerEdit}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setSelectedTeamId((current) => current === team.teamId ? null : team.teamId)}
                            >
                              {isSelected ? "Hide details" : "View team"}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedTeamId(team.teamId);
                                openSkillPlannerTeam(team.teamId);
                              }}
                            >
                              Edit team
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="planner-team-summary-row">
                      <span>{sectionRowCount} editable rows</span>
                      <span>{persistedCount} persisted / {currentCount} current</span>
                    </div>
                    {isSelected ? (
                      <div className="planner-skill-section-stack">
                        {sections.map((section) => (
                          <Card key={section.key} variant="subtle" className="planner-skill-section-card">
                            <CardContent className="planner-panel-stack">
                              <SectionHeader
                                eyebrow="Category"
                                title={section.label}
                              />
                              {section.groups.map((group) => (
                                <div key={`${section.key}-${group.groupIndex ?? "base"}`} className="planner-panel-stack planner-skill-group">
                                  {group.groupLabel ? (
                                    <div className="planner-inline-actions">
                                      <strong>{group.groupLabel}</strong>
                                    </div>
                                  ) : null}
                                  <div className="planner-skill-row-list">
                                    {group.selections.map((selection) => (
                                      <div key={selection.id} className="planner-skill-row">
                                        <Input
                                          label="Skill"
                                          value={selection.skillName}
                                          disabled={!isEditing}
                                          onChange={(event) => updateSkillPlannerSelection(selection.id, "skillName", event.target.value)}
                                        />
                                        <div className="planner-skill-level-field">
                                          <span className="planner-field-label">Level</span>
                                          <div className="planner-skill-level-toggle" role="group" aria-label="Skill level">
                                            {SKILL_LEVEL_OPTIONS.map((option) => {
                                              const isActive = selection.levelLabel === option;

                                              return (
                                                <button
                                                  key={option}
                                                  type="button"
                                                  className={isActive ? "planner-skill-level-toggle__button is-active" : "planner-skill-level-toggle__button"}
                                                  onClick={() => updateSkillPlannerSelection(selection.id, "levelLabel", option)}
                                                  disabled={!isEditing}
                                                  aria-pressed={isActive}
                                                >
                                                  {option}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                        {isEditing ? (
                                          <div className="planner-skill-row-action">
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => removeSkillPlannerSelection(selection.id)}
                                              disabled={group.selections.length <= 1}
                                            >
                                              Remove
                                            </Button>
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                  {isEditing ? (
                                    <div className="planner-skill-add-action">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => addSkillPlannerSelection(section.key, group.groupIndex)}
                                      >
                                        +
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            }) : (
              <EmptyState title="No team inputs available yet." description="Create teams and assign athletes before Skill Planner can consume them." />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

