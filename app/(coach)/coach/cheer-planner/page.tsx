import { CheerPlannerTryouts } from "@/components/tools/cheer-planner-tryouts";
import { getAuthSession } from "@/lib/auth/session";
import { getGymRegistrationNumberModeForSession } from "@/lib/services/gym-registration-settings";

export const dynamic = "force-dynamic";

export default async function CoachCheerPlannerPage() {
  const session = await getAuthSession();
  const registrationNumberMode = await getGymRegistrationNumberModeForSession(session);

  return <CheerPlannerTryouts scope="coach" registrationNumberMode={registrationNumberMode} />;
}
