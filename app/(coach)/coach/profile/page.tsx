import { Badge, ButtonLink, Card, DetailGrid, PageColumns, PageMainColumn, PageSideColumn, PageHero, StatGrid } from "@/components/ui";

const teams = ["Senior Elite", "Junior Level 2", "Open Coed Prep"];
const achievements = [
  "8 years coaching all-star and school cheer teams.",
  "Focus on routine structure, score optimization, and athlete progression.",
  "Works across elite and prep divisions with performance tracking workflows."
];

export default function CoachProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="profile-hero">
        <div className="profile-cover" />
        <div className="ui-card__content profile-hero-body">
          <div className="profile-avatar" aria-hidden="true">
            EM
          </div>

          <div className="profile-hero-main">
            <div className="profile-hero-copy">
              <div className="metric-label">Profile</div>
              <h1 className="profile-name">Edith Morales</h1>
              <p className="profile-headline">Coach, choreographer, and owner at Captive Precision</p>
              <p className="profile-meta">Miami, Florida, 12 years in cheer development</p>
              <div className="profile-chip-row">
                <Badge variant="subtle">Independent Coach</Badge>
                <Badge variant="accent">Eligible for gym assignment</Badge>
              </div>
            </div>

            <ButtonLink variant="secondary" href="/coach/profile/edit">Edit profile</ButtonLink>
          </div>
        </div>
      </Card>

      <PageColumns className="profile-layout">
        <PageMainColumn className="profile-main-column">
          <PageHero
            className="profile-section"
            contentClassName="profile-section"
            eyebrow="About"
            title="Professional summary"
            description="Captive Precision is building a premium toolkit for cheer coaches and program owners. This profile acts as the public-facing identity inside the platform and will later connect to saved tools, memberships, and history."
          />

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Teams</span>
                  <h2 className="ui-section-header__title">Current teams</h2>
                </div>
              </div>
              <div className="profile-chip-row">
                {teams.map((team) => (
                  <Badge variant="neutral" key={team}>{team}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Highlights</span>
                  <h2 className="ui-section-header__title">What this coach focuses on</h2>
                </div>
              </div>
              <ul className="profile-list">
                {achievements.map((achievement) => (
                  <li key={achievement}>{achievement}</li>
                ))}
              </ul>
            </div>
          </Card>
        </PageMainColumn>

        <PageSideColumn className="profile-side-column">
          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Details</span>
                  <h2 className="ui-section-header__title">Profile details</h2>
                </div>
              </div>
              <DetailGrid className="profile-detail-grid">
                <div>
                  <span className="profile-detail-label">Full name</span>
                  <p className="profile-detail-value">Edith Morales</p>
                </div>
                <div>
                  <span className="profile-detail-label">Gym</span>
                  <p className="profile-detail-value">Captive Precision Athletics</p>
                </div>
                <div>
                  <span className="profile-detail-label">Primary role</span>
                  <p className="profile-detail-value">Owner / Head Coach</p>
                </div>
                <div>
                  <span className="profile-detail-label">Teams</span>
                  <p className="profile-detail-value">3 active teams</p>
                </div>
                <div>
                  <span className="profile-detail-label">Coach type</span>
                  <p className="profile-detail-value">Independent coach</p>
                </div>
              </DetailGrid>
            </div>
          </Card>

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <span className="ui-section-header__eyebrow">Quick stats</span>
                  <h2 className="ui-section-header__title">Platform summary</h2>
                </div>
              </div>
              <StatGrid className="profile-stat-grid">
                <Card variant="subtle">
                  <div className="profile-stat-card__content">
                    <div className="metric-label">Tools used</div>
                    <div className="metric-value">1</div>
                    <div className="metric-subtext">Cheer Score Calculator</div>
                  </div>
                </Card>
                <Card variant="subtle">
                  <div className="profile-stat-card__content">
                    <div className="metric-label">Programs</div>
                    <div className="metric-value">3</div>
                    <div className="metric-subtext">Tracked under this profile</div>
                  </div>
                </Card>
              </StatGrid>
            </div>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}
