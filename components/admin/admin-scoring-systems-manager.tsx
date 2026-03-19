"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  DetailGrid,
  Input,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  SectionHeader,
  Select,
  Tabs,
  Textarea
} from "@/components/ui";
import { useScoringSystems } from "@/lib/scoring/use-scoring-systems";
import { getSystemById, getVersionById, type ScoringSystem, type ScoringSystemVersion } from "@/lib/scoring/scoring-systems";

function parseNumericValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function cloneVersion(version: ScoringSystemVersion): ScoringSystemVersion {
  return {
    ...version,
    sections: version.sections.map((section) => ({ ...section }))
  };
}

function buildNewSystemIndex(count: number) {
  return count + 1;
}

function buildNewSystem(systemCount: number): ScoringSystem {
  const index = buildNewSystemIndex(systemCount);
  const systemStamp = Date.now();
  const versionId = `custom-version-${systemStamp}`;

  return {
    id: `custom-system-${systemStamp}`,
    name: `Custom System ${index}`,
    slug: `custom-system-${index}`,
    activeVersionId: versionId,
    versions: [
      {
        id: versionId,
        label: "2025-2026",
        season: "2025-2026",
        status: "Draft",
        comments: "Custom scoring system in progress.",
        sections: [{ id: `section-${systemStamp}`, name: "Section 1", maxPoints: 0 }]
      }
    ]
  };
}

function buildVersionCopy(version: ScoringSystemVersion) {
  return {
    ...cloneVersion(version),
    id: `version-${Date.now()}`,
    label: `${version.label} Copy`,
    season: `${version.season} Copy`,
    status: "Draft"
  };
}

export function AdminScoringSystemsManager() {
  const { config, setConfig, isReady } = useScoringSystems();
  const [selectedSystemId, setSelectedSystemId] = useState(config.activeSystemId);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [draftVersion, setDraftVersion] = useState<ScoringSystemVersion | null>(null);

  const selectedSystem = useMemo(
    () => getSystemById(config, selectedSystemId),
    [config, selectedSystemId]
  );

  const selectedVersion = useMemo(
    () => getVersionById(selectedSystem, selectedVersionId || selectedSystem.activeVersionId),
    [selectedSystem, selectedVersionId]
  );

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setSelectedSystemId((current) => current || config.activeSystemId);
  }, [config.activeSystemId, isReady]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setSelectedVersionId(selectedSystem.activeVersionId);
  }, [isReady, selectedSystem.activeVersionId, selectedSystem.id]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    setDraftVersion(cloneVersion(selectedVersion));
  }, [isReady, selectedVersion]);

  if (!isReady || !draftVersion) {
    return null;
  }

  const activeSystem = getSystemById(config, config.activeSystemId);
  const activeVersion = getVersionById(activeSystem, activeSystem.activeVersionId);
  const totalMaxPoints = draftVersion.sections.reduce((sum, section) => sum + section.maxPoints, 0);

  const updateDraftVersion = (updater: (current: ScoringSystemVersion) => ScoringSystemVersion) => {
    setDraftVersion((current) => (current ? updater(current) : current));
  };

  const saveDraft = () => {
    setConfig((current) => ({
      ...current,
      systems: current.systems.map((system) => (
        system.id === selectedSystem.id
          ? {
              ...system,
              versions: system.versions.map((version) => (
                version.id === draftVersion.id ? cloneVersion(draftVersion) : version
              ))
            }
          : system
      ))
    }));
  };

  const saveAsVersion = () => {
    const nextVersion = buildVersionCopy(draftVersion);

    setConfig((current) => ({
      ...current,
      systems: current.systems.map((system) => (
        system.id === selectedSystem.id
          ? {
              ...system,
              versions: [...system.versions, nextVersion]
            }
          : system
      ))
    }));
    setSelectedVersionId(nextVersion.id);
    setDraftVersion(nextVersion);
  };

  const createSystem = () => {
    const nextSystem = buildNewSystem(config.systems.length);
    setConfig((current) => ({
      ...current,
      systems: [...current.systems, nextSystem]
    }));
    setSelectedSystemId(nextSystem.id);
    setSelectedVersionId(nextSystem.activeVersionId);
    setDraftVersion(cloneVersion(nextSystem.versions[0]));
  };

  const versionTabs = selectedSystem.versions.map((version) => ({
    value: version.id,
    label: (
      <span className="scoring-admin-tab-copy">
        <span>{version.label}</span>
        <small>{version.status}</small>
      </span>
    )
  }));

  return (
    <main className="workspace-shell page-stack scoring-admin-shell">
      <PageHero
        className="scoring-admin-hero"
        contentClassName="scoring-admin-hero"
        eyebrow="Scoring systems"
        title={selectedSystem.name}
        description="Versions by season and scoring structure."
        actions={
          <Button type="button" variant="secondary" onClick={createSystem}>
            Create new system
          </Button>
        }
      >
        <div className="scoring-admin-system-header">
          <Select
            id="scoring-system-selector"
            label="System"
            value={selectedSystem.id}
            onChange={(event) => setSelectedSystemId(event.target.value)}
            containerClassName="scoring-admin-system-selector"
          >
            {config.systems.map((system) => (
              <option key={system.id} value={system.id}>
                {system.name}
              </option>
            ))}
          </Select>
        </div>
      </PageHero>

      <PageColumns className="scoring-admin-layout">
        <PageMainColumn className="scoring-admin-main">
          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader
                eyebrow="Versions"
                title="Season list"
                actions={
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setConfig((current) => ({
                        ...current,
                        activeSystemId: selectedSystem.id,
                        systems: current.systems.map((system) => (
                          system.id === selectedSystem.id
                            ? { ...system, activeVersionId: selectedVersion.id }
                            : system
                        ))
                      }));
                    }}
                  >
                    Set active version
                  </Button>
                }
              />

              <Tabs
                items={versionTabs}
                value={selectedVersion.id}
                onValueChange={setSelectedVersionId}
                className="scoring-admin-tabs-shell"
                listClassName="scoring-admin-tabs"
                triggerClassName="scoring-admin-tab"
                ariaLabel="Scoring system versions"
              />
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader
                eyebrow="Version settings"
                title={draftVersion.label}
                actions={<Badge variant="subtle">{draftVersion.status}</Badge>}
              />

              <div className="scoring-admin-grid">
                <Input
                  id="version-label"
                  label="Version"
                  type="text"
                  value={draftVersion.label}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, label: event.target.value }))}
                />
                <Input
                  id="version-season"
                  label="Season"
                  type="text"
                  value={draftVersion.season}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, season: event.target.value }))}
                />
                <Textarea
                  id="version-comments"
                  label="Comments"
                  rows={4}
                  containerClassName="scoring-admin-grid__full"
                  value={draftVersion.comments}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, comments: event.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader
                eyebrow="Scoring breakdown"
                title={draftVersion.label}
                actions={<Badge variant="accent">{draftVersion.sections.length} items</Badge>}
              />

              <div className="scoring-admin-sections">
                {draftVersion.sections.map((section, index) => (
                  <Card key={section.id} variant="subtle" className="scoring-admin-section-card">
                    <CardContent className="scoring-admin-section-row">
                      <Badge variant="accent" className="scoring-admin-section-index">{index + 1}</Badge>
                      <Input
                        label="Section"
                        type="text"
                        value={section.name}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          updateDraftVersion((current) => ({
                            ...current,
                            sections: current.sections.map((item) => (
                              item.id === section.id ? { ...item, name: nextValue } : item
                            ))
                          }));
                        }}
                      />
                      <Input
                        label="Max"
                        type="number"
                        step="0.001"
                        min="0"
                        value={section.maxPoints}
                        onChange={(event) => {
                          const nextValue = parseNumericValue(event.target.value);
                          updateDraftVersion((current) => ({
                            ...current,
                            sections: current.sections.map((item) => (
                              item.id === section.id ? { ...item, maxPoints: nextValue } : item
                            ))
                          }));
                        }}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="scoring-admin-save-row">
                <Button type="button" variant="primary" size="lg" onClick={saveDraft}>
                  Save
                </Button>
                <Button type="button" variant="secondary" size="lg" onClick={saveAsVersion}>
                  Save as version
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageMainColumn>

        <PageSideColumn className="scoring-admin-side">
          <Card radius="panel">
            <CardContent className="scoring-admin-panel">
              <SectionHeader eyebrow="Live sync" title="Calculator" />
              <DetailGrid className="scoring-admin-summary-list">
                <div>
                  <span className="profile-detail-label">System</span>
                  <p className="profile-detail-value">{activeSystem.name}</p>
                </div>
                <div>
                  <span className="profile-detail-label">Version</span>
                  <p className="profile-detail-value">{activeVersion.label}</p>
                </div>
                <div>
                  <span className="profile-detail-label">Total max</span>
                  <p className="profile-detail-value">{totalMaxPoints}</p>
                </div>
              </DetailGrid>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}

