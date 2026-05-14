import { revalidatePath } from "next/cache";

import { Button, ButtonLink, Card, CardContent, Input, SectionHeader, Textarea } from "@/components/ui";
import { requireAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function updateGymProfile(formData: FormData) {
  "use server";

  const session = await requireAuthSession("gym");
  const gymName = String(formData.get("gymName") ?? "").trim();
  const gymDescription = String(formData.get("gymDescription") ?? "").trim();
  const admin = createAdminClient();

  await admin
    .from("profiles" as never)
    .update({
      gym_name: gymName || null,
      bio: gymDescription || null
    } as never)
    .eq("id", session.userId as never);

  revalidatePath("/gym/profile");
  revalidatePath("/gym/manage-my-gym");
}

export default async function GymProfilePage() {
  const session = await requireAuthSession("gym");

  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="settings-hero">
        <CardContent className="settings-hero">
          <SectionHeader
            eyebrow="Gym Profile"
            title={session.primaryGymName || "Configure Your Gym Profile"}
            description="Set the organization name and description used across the gym workspace."
            actions={<ButtonLink variant="secondary" href="/gym/manage-my-gym">Back To Manage My Gym</ButtonLink>}
          />
        </CardContent>
      </Card>

      <Card radius="panel" className="settings-section">
        <CardContent className="settings-section">
          <form action={updateGymProfile} className="profile-form">
            <div className="profile-form-grid">
              <Input
                id="gymName"
                name="gymName"
                label="Gym Name"
                defaultValue={session.primaryGymName ?? ""}
                containerClassName="profile-form-field profile-form-field-full"
              />
              <Textarea
                id="gymDescription"
                name="gymDescription"
                label="Gym Description"
                defaultValue={session.bio ?? ""}
                rows={5}
                containerClassName="profile-form-field profile-form-field-full"
              />
            </div>
            <div className="profile-form-actions">
              <Button type="submit" variant="primary">Save Profile</Button>
              <ButtonLink variant="ghost" href="/gym/manage-my-gym">Cancel</ButtonLink>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
