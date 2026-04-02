import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Button, ButtonLink, FormShell, Input, SectionHeader, Textarea } from "@/components/ui";
import { requireAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "CP";
}

async function saveCoachProfile(formData: FormData) {
  "use server";

  const session = await requireAuthSession("coach");
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const displayName = String(formData.get("full_name") ?? "").trim();
  const roleLabel = String(formData.get("role_label") ?? "").trim();
  const gymName = String(formData.get("gym_name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const teamsSummary = String(formData.get("teams_summary") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const avatarUrl = String(formData.get("avatar_url") ?? "").trim();

  if (!displayName) {
    throw new Error("Full name is required.");
  }

  const payload = {
    display_name: displayName,
    role_label: roleLabel || null,
    gym_name: gymName || null,
    city: city || null,
    state: state || null,
    headline: headline || null,
    teams_summary: teamsSummary || null,
    bio: bio || null,
    avatar_url: avatarUrl || null
  };

  const { error } = await supabase
    .from("profiles" as never)
    .update(payload as never)
    .eq("id", session.userId as never);

  if (error) {
    throw new Error(error.message);
  }

  await admin.auth.admin.updateUserById(session.userId, {
    user_metadata: {
      display_name: displayName,
      avatar_url: avatarUrl || null
    }
  });

  revalidatePath("/coach/profile");
  revalidatePath("/coach/profile/edit");
  revalidatePath("/coach/settings");
  redirect("/coach/profile");
}

export default async function CoachProfileEditPage() {
  const session = await requireAuthSession("coach");
  const gymName = session.primaryGymName ?? "";
  const role = session.roleLabel ?? (session.primaryGymName ? "Gym Coach" : "Independent Coach");
  const headline = session.headline ?? gymName;
  const teamsSummary = session.teamsSummary ?? "";
  const about = session.bio ?? "";

  return (
    <main className="workspace-shell page-stack">
      <FormShell className="profile-edit-shell" contentClassName="profile-edit-shell">
        <SectionHeader
          eyebrow="Profile editor"
          title="Edit profile"
          description="Update the profile information shown across the coach workspace and sidebar."
          actions={<ButtonLink variant="secondary" href="/coach/profile">Back to profile</ButtonLink>}
        />

        <form className="profile-form" action={saveCoachProfile}>
          <section className="profile-photo-row">
            <div className="profile-avatar profile-avatar-edit" aria-hidden="true">
              {getInitials(session.displayName)}
            </div>
            <Input
              id="avatar-url"
              name="avatar_url"
              label="Profile photo"
              defaultValue={session.avatarUrl ?? ""}
              hint="Paste an image URL for now. File upload can come later."
              containerClassName="profile-form-field"
            />
          </section>

          <div className="profile-form-grid">
            <Input id="full-name" name="full_name" label="Full name" defaultValue={session.displayName} containerClassName="profile-form-field" />
            <Input id="role-label" name="role_label" label="Role" defaultValue={role} containerClassName="profile-form-field" />
            <Input id="gym-name" name="gym_name" label="Gym" defaultValue={gymName} containerClassName="profile-form-field" />
            <Input id="city" name="city" label="City" defaultValue={session.city ?? ""} containerClassName="profile-form-field" />
            <Input id="state" name="state" label="State" defaultValue={session.state ?? ""} containerClassName="profile-form-field" />
            <Input
              id="headline"
              name="headline"
              label="Headline"
              defaultValue={headline}
              containerClassName="profile-form-field profile-form-field-full"
            />
            <Input
              id="teams-summary"
              name="teams_summary"
              label="Teams"
              defaultValue={teamsSummary}
              containerClassName="profile-form-field profile-form-field-full"
            />
            <Textarea
              id="bio"
              name="bio"
              label="About"
              rows={6}
              defaultValue={about}
              containerClassName="profile-form-field profile-form-field-full"
            />
          </div>

          <div className="profile-form-actions">
            <Button type="submit">Save changes</Button>
            <ButtonLink variant="ghost" href="/coach/profile">Cancel</ButtonLink>
          </div>
        </form>
      </FormShell>
    </main>
  );
}

