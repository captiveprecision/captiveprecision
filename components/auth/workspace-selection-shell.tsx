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
    <main className="landing-shell page-stack workspace-selection-shell">
      <PageColumns className="landing-top-grid">
        <PageMainColumn className="landing-main-column">
          <PageHero
            className="landing-hero-card workspace-selection-hero"
            contentClassName="landing-hero-content workspace-selection-hero__content"
            title={`Welcome back ${session.displayName}`}
            description="Choose the workspace you want to start with."
          >
            <DetailGrid className="landing-session-grid workspace-selection-session-grid">
              <div className="landing-session-block workspace-selection-session-block">
                <Badge variant="accent">{session.email}</Badge>
              </div>
            </DetailGrid>

            <StatGrid className="landing-role-grid workspace-selection-role-grid">
              {session.roles.map((role) => (
                <Card key={role} className="landing-role-card workspace-selection-role-card">
                  <CardContent className="landing-role-card__content workspace-selection-role-card__content">
                    <div className="landing-role-card__copy workspace-selection-role-card__copy">
                      <h3 className="ui-card__title">{roleLabel[role]}</h3>
                      <p className="muted-copy">{roleCopy[role]}</p>
                    </div>
                    <ButtonLink href={`/${role}`} variant="secondary" size="md">
                      Open {roleLabel[role]}
                    </ButtonLink>
                  </CardContent>
                </Card>
              ))}
            </StatGrid>
          </PageHero>

          <div className="workspace-selection-footer">
            <Button type="button" variant="ghost" size="md" className="workspace-selection-logout" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </PageMainColumn>

        <PageSideColumn className="landing-side-column workspace-selection-side-column">
          <Card radius="panel" className="landing-auth-card workspace-selection-side-card">
            <CardContent className="landing-auth-card__content">
              <div className="landing-auth-card__intro">
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


