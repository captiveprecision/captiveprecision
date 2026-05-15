import { ButtonLink } from "@/components/ui";
import { ManageGymSeasonsManager } from "@/components/gym/manage-gym-seasons-manager";
import { requireAuthSession } from "@/lib/auth/session";
import { listGymSeasons, resolveGymSeasonAdminAccess } from "@/lib/services/gym-seasons";

export const dynamic = "force-dynamic";

export default async function ManageGymSeasonsPage() {
  const session = await requireAuthSession("gym");
  const access = await resolveGymSeasonAdminAccess(session);

  if (!access.ok) {
    return (
      <main className="workspace-shell page-stack">
        <section className="surface-card panel-pad settings-hero">
          <div className="metric-label">Manage my gym</div>
          <h1 className="page-title settings-title">Seasons</h1>
          <p className="page-copy">
            Program Director access is required to manage gym seasons.
          </p>
          <div className="settings-inline-actions">
            <ButtonLink href="/gym/manage-my-gym" variant="secondary">Back To Manage My Gym</ButtonLink>
          </div>
        </section>
      </main>
    );
  }

  const seasons = await listGymSeasons(access.gymId);

  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad settings-hero">
        <div className="metric-label">Manage my gym</div>
        <h1 className="page-title settings-title">Seasons</h1>
        <p className="page-copy">
          Manage annual seasons for tryouts, future roster planning, and historical review without changing current teams or athletes.
        </p>
      </section>

      <ManageGymSeasonsManager initialSeasons={seasons} />
    </main>
  );
}
