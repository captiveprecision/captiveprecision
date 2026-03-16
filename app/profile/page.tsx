import Link from "next/link";

const teams = ["Senior Elite", "Junior Level 2", "Open Coed Prep"];
const achievements = [
  "8 years coaching all-star and school cheer teams.",
  "Focus on routine structure, score optimization, and athlete progression.",
  "Works across elite and prep divisions with performance tracking workflows."
];

export default function ProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card profile-hero">
        <div className="profile-cover" />
        <div className="profile-hero-body">
          <div className="profile-avatar" aria-hidden="true">
            EM
          </div>

          <div className="profile-hero-main">
            <div>
              <div className="metric-label">Profile</div>
              <h1 className="profile-name">Edith Morales</h1>
              <p className="profile-headline">Coach, choreographer, and owner at Captive Precision</p>
              <p className="profile-meta">Miami, Florida · 12 years in cheer development</p>
            </div>

            <Link className="profile-edit-button" href="/profile/edit">
              Edit profile
            </Link>
          </div>
        </div>
      </section>

      <section className="profile-layout">
        <div className="profile-main-column">
          <article className="surface-card panel-pad profile-section">
            <div className="metric-label">About</div>
            <h2>Professional summary</h2>
            <p className="muted-copy">
              Captive Precision is building a premium toolkit for cheer coaches and program owners. This profile acts as the public-facing identity inside the platform and will later connect to saved tools, memberships, and history.
            </p>
          </article>

          <article className="surface-card panel-pad profile-section">
            <div className="metric-label">Teams</div>
            <h2>Current teams</h2>
            <div className="profile-chip-row">
              {teams.map((team) => (
                <span className="profile-chip" key={team}>
                  {team}
                </span>
              ))}
            </div>
          </article>

          <article className="surface-card panel-pad profile-section">
            <div className="metric-label">Highlights</div>
            <h2>What this coach focuses on</h2>
            <ul className="profile-list">
              {achievements.map((achievement) => (
                <li key={achievement}>{achievement}</li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="profile-side-column">
          <article className="surface-card panel-pad profile-section">
            <div className="metric-label">Details</div>
            <div className="profile-detail-grid">
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
            </div>
          </article>

          <article className="surface-card panel-pad profile-section">
            <div className="metric-label">Quick stats</div>
            <div className="profile-stat-grid">
              <div className="metric-card-light">
                <div className="metric-label">Tools used</div>
                <div className="metric-value">1</div>
                <div className="metric-subtext">Cheer Score Calculator</div>
              </div>
              <div className="metric-card-light">
                <div className="metric-label">Programs</div>
                <div className="metric-value">3</div>
                <div className="metric-subtext">Tracked under this profile</div>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
