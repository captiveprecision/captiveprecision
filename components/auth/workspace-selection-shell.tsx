"use client";

import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardContent,
  DetailGrid,
  PageColumns,
  PageHero,
  PageMainColumn,
  PageSideColumn,
  StatGrid
} from "@/components/ui";
import type { AuthSession } from "@/lib/auth/session";

type WorkspaceSelectionShellProps = {
  session: AuthSession;
};

const roleCopy = {
  coach: "Teams, tools, personal performance flow.",
  gym: "Licenses, coaches, teams, athletes, organization stats.",
  admin: "Platform controls, scoring systems, internal operations."
} as const;

const roleLabel = {
  coach: "Coach",
  gym: "Gym",
  admin: "Admin"
} as const;

export function WorkspaceSelectionShell({ session }: WorkspaceSelectionShellProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <main className="landing-shell page-stack">
      <PageColumns className="landing-top-grid">
        <PageMainColumn className="landing-main-column">
          <PageHero
            className="landing-hero-card"
            contentClassName="landing-hero-content"
            eyebrow={<Badge variant="accent">Captive Precision</Badge>}
            title="Choose your workspace."
            description="This account can move across multiple workspace types. Select the environment you want to open for this session."
          >
            <DetailGrid className="landing-session-grid">
              <div className="landing-session-block">
                <span className="metric-label">Signed in as</span>
                <p className="landing-session-value">{session.displayName}</p>
                <p className="landing-session-meta">{session.email}</p>
              </div>
              <div className="landing-session-block">
                <span className="metric-label">Workspace access</span>
                <div className="landing-session-badges">
                  {session.roles.map((role) => (
                    <Badge key={role} variant="subtle">
                      {roleLabel[role]}
                    </Badge>
                  ))}
                </div>
              </div>
            </DetailGrid>

            <StatGrid className="landing-role-grid">
              {session.roles.map((role) => (
                <Card key={role} className="landing-role-card">
                  <CardContent className="landing-role-card__content">
                    <div className="landing-role-card__copy">
                      <span className="metric-label">Workspace</span>
                      <h3 className="ui-card__title">{roleLabel[role]}</h3>
                      <p className="muted-copy">{roleCopy[role]}</p>
                    </div>
                    <ButtonLink href={`/${role}`} variant="secondary" size="lg">
                      Open {roleLabel[role]}
                    </ButtonLink>
                  </CardContent>
                </Card>
              ))}
            </StatGrid>
          </PageHero>
        </PageMainColumn>

        <PageSideColumn className="landing-side-column">
          <Card radius="panel" className="landing-auth-card">
            <CardContent className="landing-auth-card__content">
              <div className="landing-auth-card__intro">
                <span className="metric-label">Session</span>
                <h2 className="ui-card__title">Account controls</h2>
                <p className="muted-copy">Leave this session and return to the landing screen to sign in with another account.</p>
              </div>
              <Button type="button" variant="secondary" size="lg" onClick={handleLogout}>
                Log out
              </Button>
            </CardContent>
          </Card>
        </PageSideColumn>
      </PageColumns>
    </main>
  );
}

