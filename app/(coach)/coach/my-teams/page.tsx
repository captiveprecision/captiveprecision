import { MyTeamsWorkspaceShell } from "@/components/features/my-teams/my-teams-workspace-shell";
import { requireAuthSession } from "@/lib/auth/session";
import { listAvailableCoachOptionsForSession } from "@/lib/services/team-coach-directory";

export default async function CoachMyTeamsPage() {
  const session = await requireAuthSession("coach");
  const coachOptions = await listAvailableCoachOptionsForSession(session);

  return <MyTeamsWorkspaceShell coachOptions={coachOptions} />;
}
