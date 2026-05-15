import { GymSidebar } from "@/components/navigation/gym-sidebar";
import { requireAuthSession } from "@/lib/auth/session";
import { getActiveGymSeasonForGym } from "@/lib/services/gym-seasons";

export default async function GymLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAuthSession("gym");
  const activeSeason = await getActiveGymSeasonForGym(session.primaryGymId);

  return (
    <div className="app-frame">
      <GymSidebar
        activeSeasonLabel={activeSeason?.label ?? null}
        availableWorkspaces={session.roles}
        gymName={session.primaryGymName}
      />
      <div className="app-main">{children}</div>
    </div>
  );
}
