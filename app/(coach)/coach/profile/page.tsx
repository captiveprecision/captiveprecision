import { Pencil } from "lucide-react";
import { Badge, ButtonLink, Card, DetailGrid, PageColumns, PageMainColumn, PageSideColumn, PageHero, StatGrid } from "@/components/ui";
import { requireAuthSession } from "@/lib/auth/session";

const fallbackAchievements = [
  "8 years coaching all-star and school cheer teams.",
  "Focus on routine structure, score optimization, and athlete progression.",
  "Works across elite and prep divisions with performance tracking workflows."
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CP";
}

export default async function CoachProfilePage() {
  const session = await requireAuthSession("coach");
  const gymName = session.primaryGymName ?? "Independent";
  const location = [session.city, session.state].filter(Boolean).join(", ") || "Not set yet";
  const role = session.roleLabel ?? (session.primaryGymName ? "Gym Coach" : "Independent Coach");
  const headline = session.headline ?? gymName;
  const about = session.bio ?? "Update this profile from Edit to add your professional summary.";
  const teams = (session.teamsSummary ?? "").split(",").map((team) => team.trim()).filter(Boolean);

  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="profile-hero">
        <div className="profile-cover" />
        <div className="ui-card__content profile-hero-body">
          <div className="profile-avatar" aria-hidden="true">
            {getInitials(session.displayName)}
          </div>

          <div className="profile-hero-main">
            <div className="profile-hero-copy">
              <h1 className="profile-name">{session.displayName}</h1>
              <p className="profile-headline">{headline}</p>
              <p className="profile-meta">{location}</p>
              <div className="profile-chip-row">
                <Badge variant="subtle">{role}</Badge>
                <Badge variant="accent">{gymName}</Badge>
              </div>
            </div>

            <ButtonLink variant="ghost" href="/coach/profile/edit" leadingIcon={<Pencil />}>Edit</ButtonLink>
          </div>
        </div>
      </Card>

      <PageColumns className="profile-layout">
        <PageMainColumn className="profile-main-column">
          <PageHero
            className="profile-section"
            contentClassName="profile-section"
            title="Professional summary"
            description={about}
          />

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <h2 className="ui-section-header__title">Current teams</h2>
                </div>
              </div>
              <div className="profile-chip-row">
                {(teams.length ? teams : ["No teams added yet"]).map((team) => (
                  <Badge variant="neutral" key={team}>{team}</Badge>
                ))}
              </div>
            </div>
          </Card>

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
                  <h2 className="ui-section-header__title">What this coach focuses on</h2>
                </div>
              </div>
              <ul className="profile-list">
                {fallbackAchievements.map((achievement) => (
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
                  <h2 className="ui-section-header__title">Contact details</h2>
                </div>
              </div>
              <DetailGrid className="profile-detail-grid">
                <div>
                  <span className="profile-detail-label">Full name</span>
                  <p className="profile-detail-value">{session.displayName}</p>
                </div>
                <div>
                  <span className="profile-detail-label">Gym</span>
                  <p className="profile-detail-value">{gymName}</p>
                </div>
                <div>
                  <span className="profile-detail-label">City / State</span>
                  <p className="profile-detail-value">{location}</p>
                </div>
                <div>
                  <span className="profile-detail-label">Role</span>
                  <p className="profile-detail-value">{role}</p>
                </div>
              </DetailGrid>
            </div>
          </Card>

          <Card radius="panel" className="profile-section">
            <div className="ui-card__content profile-section">
              <div className="ui-section-header">
                <div className="ui-section-header__copy">
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


