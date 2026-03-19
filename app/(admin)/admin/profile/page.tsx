import { EmptyState, PageHero } from "@/components/ui";

export default function AdminProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <PageHero
        contentClassName="profile-section"
        eyebrow="Admin profile"
        title="Profile"
        description="Administrative identity and ownership controls will expand here as profile modules move out of placeholder mode."
      >
        <EmptyState
          title="Admin profile modules are coming next."
          description="This placeholder stays aligned with the new system while the admin profile surface is still being defined."
        />
      </PageHero>
    </main>
  );
}
