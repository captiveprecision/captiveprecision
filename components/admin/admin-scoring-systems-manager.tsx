"use client";

import { useEffect, useMemo, useState } from "react";

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

  return (
    <main className="workspace-shell page-stack scoring-admin-shell">
      <section className="surface-card panel-pad scoring-admin-panel">
        <div className="metric-label">Scoring systems</div>
        <div className="scoring-admin-system-header">
          <div className="scoring-admin-system-selector">
            <label htmlFor="scoring-system-selector">System</label>
            <select
              id="scoring-system-selector"
              value={selectedSystem.id}
              onChange={(event) => setSelectedSystemId(event.target.value)}
            >
              {config.systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {system.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="profile-edit-button scoring-admin-secondary-action" onClick={createSystem}>
            Create new system
          </button>
        </div>
        <h1 className="page-title settings-title">{selectedSystem.name}</h1>
        <p className="page-copy">Versions by season and scoring structure.</p>
      </section>

      <section className="scoring-admin-layout">
        <div className="scoring-admin-main">
          <article className="surface-card panel-pad scoring-admin-panel">
            <div className="scoring-admin-panel-head">
              <div>
                <div className="metric-label">Versions</div>
                <h2>Season list</h2>
              </div>
              <button
                type="button"
                className="profile-edit-button scoring-admin-secondary-action"
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
              </button>
            </div>

            <div className="scoring-admin-tabs">
              {selectedSystem.versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  className="scoring-admin-tab"
                  data-active={version.id === selectedVersion.id}
                  onClick={() => setSelectedVersionId(version.id)}
                >
                  <span>{version.label}</span>
                  <small>{version.status}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="surface-card panel-pad scoring-admin-panel">
            <div className="scoring-admin-grid">
              <div className="profile-form-field">
                <label htmlFor="version-label">Version</label>
                <input
                  id="version-label"
                  type="text"
                  value={draftVersion.label}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, label: event.target.value }))}
                />
              </div>
              <div className="profile-form-field">
                <label htmlFor="version-season">Season</label>
                <input
                  id="version-season"
                  type="text"
                  value={draftVersion.season}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, season: event.target.value }))}
                />
              </div>
              <div className="profile-form-field profile-form-field-full">
                <label htmlFor="version-comments">Comments</label>
                <textarea
                  id="version-comments"
                  rows={4}
                  value={draftVersion.comments}
                  onChange={(event) => updateDraftVersion((current) => ({ ...current, comments: event.target.value }))}
                />
              </div>
            </div>
          </article>

          <article className="surface-card panel-pad scoring-admin-panel">
            <div className="scoring-admin-panel-head">
              <div>
                <div className="metric-label">Scoring breakdown</div>
                <h2>{draftVersion.label}</h2>
              </div>
              <div className="scoring-admin-stat-pill">{draftVersion.sections.length} items</div>
            </div>

            <div className="scoring-admin-sections">
              {draftVersion.sections.map((section, index) => (
                <div className="scoring-admin-section-row" key={section.id}>
                  <span className="scoring-admin-section-index">{index + 1}</span>
                  <div className="scoring-admin-section-name">
                    <label>Section</label>
                    <input
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
                  </div>
                  <div className="scoring-admin-section-points">
                    <label>Max</label>
                    <input
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
                  </div>
                </div>
              ))}
            </div>

            <div className="scoring-admin-save-row">
              <button type="button" className="scoring-admin-save-button" onClick={saveDraft}>
                Save
              </button>
              <button type="button" className="scoring-admin-save-button" onClick={saveAsVersion}>
                Save as version
              </button>
            </div>
          </article>
        </div>

        <aside className="scoring-admin-side">
          <article className="surface-card panel-pad scoring-admin-panel">
            <div className="metric-label">Live sync</div>
            <h2>Calculator</h2>
            <div className="scoring-admin-summary-list">
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
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}

