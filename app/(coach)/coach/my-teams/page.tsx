import { MyTeamsWorkspaceShell } from "@/components/features/my-teams/my-teams-workspace-shell";
import { requireAuthSession } from "@/lib/auth/session";
import { getGymRegistrationNumberModeForSession } from "@/lib/services/gym-registration-settings";
import { listAvailableCoachOptionsForSession } from "@/lib/services/team-coach-directory";

export const dynamic = "force-dynamic";

export default async function CoachMyTeamsPage() {
  const session = await requireAuthSession("coach");
  const coachOptions = await listAvailableCoachOptionsForSession(session);
  const registrationNumberMode = await getGymRegistrationNumberModeForSession(session);

  return <MyTeamsWorkspaceShell coachOptions={coachOptions} registrationNumberMode={registrationNumberMode} />;
}
