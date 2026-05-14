import { AdminAccountsManager, type AdminCoachAccount, type AdminGymAccount, type AdminGymOption, type AdminUserAccount } from "@/components/admin/admin-accounts-manager";
import { requireAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

export const dynamic = "force-dynamic";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type GymRow = Database["public"]["Tables"]["gyms"]["Row"];
type GymCoachLicenseRow = Database["public"]["Tables"]["gym_coach_licenses"]["Row"];
type UserMembershipRow = Database["public"]["Tables"]["user_memberships"]["Row"];
type MembershipPlanRow = Database["public"]["Tables"]["membership_plans"]["Row"];

type AccountProfile = Pick<
  ProfileRow,
  "id" | "display_name" | "email" | "role" | "beta_access_status" | "primary_gym_id" | "membership_type" | "gym_name" | "created_at"
>;

type AccountGym = Pick<GymRow, "id" | "name" | "slug" | "owner_profile_id" | "coach_license_limit" | "membership_plan_id" | "created_at">;
type AccountLicense = Pick<GymCoachLicenseRow, "id" | "gym_id" | "coach_profile_id" | "status">;
type AccountMembership = Pick<UserMembershipRow, "user_id" | "membership_plan_id" | "provider" | "status" | "current_period_end" | "provider_membership_id">;
type AccountPlan = Pick<MembershipPlanRow, "id" | "code" | "name">;

function displayName(profile: Pick<AccountProfile, "display_name" | "email"> | null | undefined) {
  return profile?.display_name || profile?.email || "Unnamed account";
}

function displayEmail(profile: Pick<AccountProfile, "email"> | null | undefined) {
  return profile?.email || "No email";
}

function isMembershipActive(membership: AccountMembership | undefined) {
  if (!membership) {
    return false;
  }

  if (membership.status !== "active" && membership.status !== "trialing") {
    return false;
  }

  return !membership.current_period_end || new Date(membership.current_period_end).getTime() > Date.now();
}

function getBestMembershipForUser(memberships: AccountMembership[], userId: string) {
  const candidates = memberships.filter((membership) => membership.user_id === userId);
  return candidates.find(isMembershipActive) ?? candidates[0];
}

function membershipLabel(membership: AccountMembership | undefined, planById: Map<string, AccountPlan>) {
  if (!membership) {
    return "No Premium";
  }

  const plan = membership.membership_plan_id ? planById.get(membership.membership_plan_id) : null;
  const source = membership.provider === "manual" ? "Manual" : membership.provider;
  return `${plan?.name ?? "Membership"} / ${source} / ${membership.status}`;
}

export default async function AdminAccountsPage() {
  await requireAuthSession("admin");

  const admin = createAdminClient();
  const [profilesResult, gymsResult, licensesResult, membershipsResult, plansResult] = await Promise.all([
    admin
      .from("profiles" as never)
      .select("id, display_name, email, role, beta_access_status, primary_gym_id, membership_type, gym_name, created_at" as never)
      .order("created_at", { ascending: false }),
    admin
      .from("gyms" as never)
      .select("id, name, slug, owner_profile_id, coach_license_limit, membership_plan_id, created_at" as never)
      .order("created_at", { ascending: false }),
    admin
      .from("gym_coach_licenses" as never)
      .select("id, gym_id, coach_profile_id, status" as never),
    admin
      .from("user_memberships" as never)
      .select("user_id, membership_plan_id, provider, status, current_period_end, provider_membership_id" as never)
      .order("updated_at", { ascending: false }),
    admin
      .from("membership_plans" as never)
      .select("id, code, name" as never)
  ]);

  const profiles = (profilesResult.data ?? []) as AccountProfile[];
  const gymRows = (gymsResult.data ?? []) as AccountGym[];
  const licenses = (licensesResult.data ?? []) as AccountLicense[];
  const memberships = (membershipsResult.data ?? []) as AccountMembership[];
  const plans = (plansResult.data ?? []) as AccountPlan[];

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const gymById = new Map(gymRows.map((gym) => [gym.id, gym]));
  const planById = new Map(plans.map((plan) => [plan.id, plan]));

  const gyms: AdminGymAccount[] = gymRows.map((gym) => {
    const owner = profileById.get(gym.owner_profile_id);
    const ownerMembership = getBestMembershipForUser(memberships, gym.owner_profile_id);
    const gymLicenses = licenses.filter((license) => license.gym_id === gym.id);
    const activeCoachLicenses = gymLicenses.filter((license) => license.status === "active").length;
    const plan = gym.membership_plan_id ? planById.get(gym.membership_plan_id) : null;

    return {
      id: gym.id,
      name: gym.name,
      slug: gym.slug,
      ownerName: displayName(owner),
      ownerEmail: displayEmail(owner),
      planLabel: plan?.name ?? membershipLabel(ownerMembership, planById),
      membershipStatus: ownerMembership?.status ?? "no membership",
      activeCoachLicenses,
      totalCoachLicenses: gym.coach_license_limit,
      createdAt: gym.created_at
    };
  });

  const coaches: AdminCoachAccount[] = profiles
    .filter((profile) => profile.role === "coach")
    .map((profile) => {
      const activeLicense = licenses.find((license) => license.coach_profile_id === profile.id && license.status === "active");
      const assignedGym = profile.primary_gym_id
        ? gymById.get(profile.primary_gym_id)
        : activeLicense
          ? gymById.get(activeLicense.gym_id)
          : null;
      const membership = getBestMembershipForUser(memberships, profile.id);

      return {
        id: profile.id,
        name: displayName(profile),
        email: displayEmail(profile),
        accessStatus: profile.beta_access_status,
        organizationName: assignedGym?.name ?? profile.gym_name ?? null,
        organizationStatus: assignedGym ? "gym_assigned" : "independent",
        membershipLabel: membershipLabel(membership, planById),
        createdAt: profile.created_at
      };
    });

  const admins: AdminUserAccount[] = profiles
    .filter((profile) => profile.role === "admin")
    .map((profile) => ({
      id: profile.id,
      name: displayName(profile),
      email: displayEmail(profile),
      accessStatus: profile.beta_access_status,
      createdAt: profile.created_at
    }));

  const gymOptions: AdminGymOption[] = gymRows.map((gym) => ({
    id: gym.id,
    name: gym.name
  }));

  return (
    <main className="workspace-shell page-stack admin-accounts-shell">
      <AdminAccountsManager gyms={gyms} coaches={coaches} admins={admins} gymOptions={gymOptions} />
    </main>
  );
}
