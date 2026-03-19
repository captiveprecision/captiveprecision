import { Button, ButtonLink, FormShell, Input, SectionHeader, Textarea } from "@/components/ui";

export default function EditProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <FormShell className="profile-edit-shell" contentClassName="profile-edit-shell">
        <SectionHeader
          eyebrow="Profile"
          title="Edit profile"
          description="Update the core information that will represent the coach or program inside the platform."
          actions={<ButtonLink variant="secondary" href="/profile">Back to profile</ButtonLink>}
        />

        <form className="profile-form">
          <section className="profile-photo-row">
            <div className="profile-avatar profile-avatar-edit" aria-hidden="true">
              EM
            </div>
            <Input
              id="photo"
              label="Profile photo"
              defaultValue="https://images.example.com/profile-edith.jpg"
              hint="Paste an image URL for now. File upload can come later."
              containerClassName="profile-form-field"
            />
          </section>

          <div className="profile-form-grid">
            <Input id="name" label="Full name" defaultValue="Edith Morales" containerClassName="profile-form-field" />
            <Input id="role" label="Role" defaultValue="Owner / Head Coach" containerClassName="profile-form-field" />
            <Input id="gym" label="Gym" defaultValue="Captive Precision Athletics" containerClassName="profile-form-field" />
            <Input id="location" label="Location" defaultValue="Miami, Florida" containerClassName="profile-form-field" />
            <Input
              id="headline"
              label="Headline"
              defaultValue="Coach, choreographer, and owner at Captive Precision"
              containerClassName="profile-form-field profile-form-field-full"
            />
            <Input
              id="teams"
              label="Teams"
              defaultValue="Senior Elite, Junior Level 2, Open Coed Prep"
              containerClassName="profile-form-field profile-form-field-full"
            />
            <Textarea
              id="about"
              label="About"
              rows={6}
              defaultValue="Captive Precision is building a premium toolkit for cheer coaches and program owners. This profile acts as the public-facing identity inside the platform and will later connect to saved tools, memberships, and history."
              containerClassName="profile-form-field profile-form-field-full"
            />
          </div>

          <div className="profile-form-actions">
            <Button type="submit">Save changes</Button>
            <ButtonLink variant="ghost" href="/profile">Cancel</ButtonLink>
          </div>
        </form>
      </FormShell>
    </main>
  );
}
