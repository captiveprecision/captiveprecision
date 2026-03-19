"use client";

import { useMemo, useState } from "react";

import { Badge, Card, DetailGrid, PageColumns, PageHero, PageMainColumn, PageSideColumn, StatGrid, Tabs } from "@/components/ui";

type TeamData = {
  id: string;
  name: string;
  division: string;
  scores: number[];
  average: string;
  trend: string;
  nextEvent: string;
  notes: string[];
};

type ChartPoint = {
  score: number;
  x: number;
  y: number;
};

const CHART_WIDTH = 720;
const CHART_HEIGHT = 260;
const CHART_LEFT = 18;
const CHART_RIGHT = 18;
const CHART_TOP = 18;
const CHART_BOTTOM = 20;

const teams: TeamData[] = [
  {
    id: "senior-elite",
    name: "Senior Elite",
    division: "Level 6",
    scores: [91.2, 92.8, 93.1, 94.4, 93.9, 95.2],
    average: "93.4",
    trend: "+2.1 pts in 6 weeks",
    nextEvent: "Atlantic Showcase - March 28",
    notes: [
      "Running tumbling execution has become more stable in the last two routines.",
      "Judges are rewarding stronger transitions and better timing in dance.",
      "One full-out this week should focus on deduction control under pressure."
    ]
  },
  {
    id: "junior-level-2",
    name: "Junior Level 2",
    division: "Level 2",
    scores: [84.9, 86.4, 87.1, 88.5, 87.8, 89.2],
    average: "87.3",
    trend: "+4.3 pts this month",
    nextEvent: "Spring Jam - April 2",
    notes: [
      "Stunt synchronization is improving and raw score gains are visible.",
      "The team is close to a cleaner pyramid section with lower risk.",
      "A sharper opening section could lift early impression scores."
    ]
  },
  {
    id: "open-coed-prep",
    name: "Open Coed Prep",
    division: "Prep Coed",
    scores: [79.5, 80.8, 81.9, 82.7, 83.4, 84.1],
    average: "82.1",
    trend: "+1.4 pts in last 2 events",
    nextEvent: "Regional Classic - April 10",
    notes: [
      "Participation is trending up and gives this team more room to climb.",
      "Lower deductions are carrying more impact than new difficulty right now.",
      "This team benefits most from consistency-focused routines."
    ]
  }
];

const teamNews = [
  {
    title: "Senior Elite hit its highest raw score this season",
    body: "The last routine posted a 95.2 and moved the team into its strongest scoring window before Atlantic Showcase.",
    tag: "Team update"
  },
  {
    title: "Junior Level 2 is trending upward in stunt sections",
    body: "Back-to-back events show stronger synchronization and better transition control, especially in the middle third of the routine.",
    tag: "Performance"
  },
  {
    title: "Open Coed Prep reduced deductions for two events in a row",
    body: "Execution cleanup is creating a steadier score floor and giving the team better confidence before regionals.",
    tag: "Coaching note"
  }
];

const systemUpdates = [
  {
    title: "Cheer Score Calculator is now the first live premium tool",
    body: "The calculator is already integrated into the product shell and sets the design system for upcoming modules."
  },
  {
    title: "Profile and settings areas were expanded",
    body: "Coaches can now preview a fuller product flow with profile editing, membership placeholders, and preference cards."
  },
  {
    title: "Next planned modules",
    body: "Team performance history, saved routine snapshots, and premium membership controls are next in line."
  }
];

function getChartCoordinates(scores: number[]): ChartPoint[] {
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const range = Math.max(max - min, 1);
  const usableWidth = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  const usableHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

  return scores.map((score, index) => {
    const x = CHART_LEFT + (index / Math.max(scores.length - 1, 1)) * usableWidth;
    const y = CHART_TOP + (1 - (score - min) / range) * usableHeight;
    return { score, x, y };
  });
}

function buildLinePath(points: ChartPoint[]) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
}

export function DashboardOverview() {
  const [activeTeamId, setActiveTeamId] = useState(teams[0].id);

  const activeTeam = useMemo(
    () => teams.find((team) => team.id === activeTeamId) ?? teams[0],
    [activeTeamId]
  );

  const chartCoordinates = useMemo(() => getChartCoordinates(activeTeam.scores), [activeTeam]);
  const chartLinePath = useMemo(() => buildLinePath(chartCoordinates), [chartCoordinates]);
  const teamTabs = useMemo(
    () => teams.map((team) => ({ value: team.id, label: team.name })),
    []
  );

  return (
    <main className="workspace-shell page-stack dashboard-shell">
      <PageColumns className="dashboard-top-grid">
        <PageMainColumn>
          <PageHero
            className="dashboard-hero"
            contentClassName="dashboard-hero"
            eyebrow="Team dashboard"
            title="Everything important for your teams, scores, and next decisions."
            description="This dashboard prioritizes team performance first: competition momentum, coaching notes, and score movement. Product updates stay visible, but secondary."
          >
            <StatGrid className="dashboard-summary-grid">
              <Card className="dashboard-summary-card">
                <div className="dashboard-stat-card__content">
                  <span className="metric-label">Active teams</span>
                  <div className="metric-value">3</div>
                  <div className="metric-subtext">Across elite, junior, and prep divisions</div>
                </div>
              </Card>
              <Card className="dashboard-summary-card">
                <div className="dashboard-stat-card__content">
                  <span className="metric-label">Best score</span>
                  <div className="metric-value">95.2</div>
                  <div className="metric-subtext">Senior Elite peak this season</div>
                </div>
              </Card>
              <Card className="dashboard-summary-card">
                <div className="dashboard-stat-card__content">
                  <span className="metric-label">Next event</span>
                  <div className="metric-value">3</div>
                  <div className="metric-subtext">Upcoming team appearances this month</div>
                </div>
              </Card>
            </StatGrid>
          </PageHero>
        </PageMainColumn>

        <PageSideColumn>
          <Card variant="dark" radius="panel" className="dashboard-priority-card">
            <div className="ui-card__content dashboard-priority-card">
              <div className="metric-label">This week</div>
              <h2 className="ui-card__title">Coaching focus</h2>
              <p className="metric-subtext">
                Deduction control and clean timing are currently giving more scoring upside than adding extra difficulty.
              </p>
              <div className="dashboard-priority-list">
                <div className="dashboard-priority-item">Senior Elite: protect execution under pressure.</div>
                <div className="dashboard-priority-item">Junior Level 2: reinforce stunt timing.</div>
                <div className="dashboard-priority-item">Open Coed Prep: keep the routine stable and clean.</div>
              </div>
            </div>
          </Card>
        </PageSideColumn>
      </PageColumns>

      <PageColumns className="dashboard-main-grid">
        <PageMainColumn className="dashboard-team-column">
          <Card radius="panel" className="dashboard-section">
            <div className="ui-card__content dashboard-section">
              <div className="dashboard-section-head">
                <div className="dashboard-section-head__copy">
                  <div className="metric-label">Score performance</div>
                  <h2 className="ui-section-header__title">Team score fluctuation</h2>
                </div>
                <Tabs
                  items={teamTabs}
                  value={activeTeam.id}
                  onValueChange={setActiveTeamId}
                  className="dashboard-tabs-shell"
                  listClassName="dashboard-tabs"
                  ariaLabel="Teams"
                />
              </div>

              <div className="dashboard-chart-wrap">
                <div className="dashboard-chart-meta">
                  <div className="dashboard-chart-meta__copy">
                    <span className="metric-label">Selected team</span>
                    <h3>{activeTeam.name}</h3>
                    <p className="muted-copy">{activeTeam.division}</p>
                  </div>
                  <DetailGrid className="dashboard-chart-stats">
                    <div>
                      <span className="profile-detail-label">Average</span>
                      <p className="profile-detail-value">{activeTeam.average}</p>
                    </div>
                    <div>
                      <span className="profile-detail-label">Trend</span>
                      <p className="profile-detail-value">{activeTeam.trend}</p>
                    </div>
                    <div>
                      <span className="profile-detail-label">Next event</span>
                      <p className="profile-detail-value">{activeTeam.nextEvent}</p>
                    </div>
                  </DetailGrid>
                </div>

                <Card variant="dark" className="dashboard-chart-card">
                  <div className="ui-card__content dashboard-chart-card__content">
                    <div className="dashboard-chart-panel-head">
                      <div>
                        <Badge variant="accent">Six-event sequence</Badge>
                        <p className="dashboard-chart-headline">Score trajectory</p>
                      </div>
                      <div className="dashboard-score-strip">
                        {activeTeam.scores.map((score, index) => (
                          <Badge variant="accent" className="dashboard-score-pill" key={`${activeTeam.id}-pill-${score}-${index}`}>
                            {score.toFixed(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="dashboard-chart-stage">
                      <div className="dashboard-chart-yaxis" aria-hidden="true">
                        <span>96</span>
                        <span>92</span>
                        <span>88</span>
                        <span>84</span>
                      </div>

                      <div className="dashboard-chart-surface">
                        <div className="dashboard-chart-grid" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                        </div>
                        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="dashboard-chart" preserveAspectRatio="none" shapeRendering="geometricPrecision">
                          <path d={chartLinePath} className="dashboard-chart-line" />
                          {chartCoordinates.map((point, index) => (
                            <circle
                              key={`${activeTeam.id}-${point.score}-${index}`}
                              cx={point.x}
                              cy={point.y}
                              r="1.2"
                              className="dashboard-chart-point-core"
                            />
                          ))}
                        </svg>
                      </div>
                    </div>

                    <div className="dashboard-chart-labels">
                      <span>Event 1</span>
                      <span>Event 2</span>
                      <span>Event 3</span>
                      <span>Event 4</span>
                      <span>Event 5</span>
                      <span>Event 6</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          <div className="dashboard-team-news-grid">
            <Card radius="panel" className="dashboard-section">
              <div className="ui-card__content dashboard-section">
                <div className="ui-section-header">
                  <div className="ui-section-header__copy">
                    <span className="ui-section-header__eyebrow">Team news</span>
                    <h2 className="ui-section-header__title">Latest from your programs</h2>
                  </div>
                </div>
                <div className="dashboard-news-list">
                  {teamNews.map((item) => (
                    <article className="dashboard-news-item" key={item.title}>
                      <Badge variant="accent" className="dashboard-news-tag">{item.tag}</Badge>
                      <h3>{item.title}</h3>
                      <p className="muted-copy">{item.body}</p>
                    </article>
                  ))}
                </div>
              </div>
            </Card>

            <Card radius="panel" className="dashboard-section">
              <div className="ui-card__content dashboard-section">
                <div className="ui-section-header">
                  <div className="ui-section-header__copy">
                    <span className="ui-section-header__eyebrow">Coach notes</span>
                    <h2 className="ui-section-header__title">{activeTeam.name}</h2>
                  </div>
                </div>
                <div className="dashboard-note-list">
                  {activeTeam.notes.map((note) => (
                    <div className="dashboard-note-item" key={note}>
                      <span className="dashboard-note-bullet" aria-hidden="true" />
                      <p>{note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </PageMainColumn>

        <PageSideColumn className="dashboard-side-column">
          <Card radius="panel" className="dashboard-section">
            <div className="ui-card__content dashboard-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Platform updates</span>
                  <h2 className="ui-section-header__title">System and tools</h2>
                </div>
              </div>
              <div className="dashboard-update-list">
                {systemUpdates.map((item) => (
                  <div className="dashboard-update-item" key={item.title}>
                    <h3>{item.title}</h3>
                    <p className="muted-copy">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card radius="panel" className="dashboard-section">
            <div className="ui-card__content dashboard-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Upcoming</span>
                  <h2 className="ui-section-header__title">Next actions</h2>
                </div>
              </div>
              <div className="dashboard-task-list">
                <div className="dashboard-task-item">Review stunt deductions before Atlantic Showcase.</div>
                <div className="dashboard-task-item">Save a Junior Level 2 benchmark after the next event.</div>
                <div className="dashboard-task-item">Prepare the next premium tool rollout announcement.</div>
              </div>
            </div>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
