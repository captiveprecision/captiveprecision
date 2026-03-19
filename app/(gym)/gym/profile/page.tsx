import { Badge, EmptyState, PageHero } from "@/components/ui";

export default function GymProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <PageHero
        contentClassName="profile-section"
        eyebrow="Gym profile"
        title="Captive Precision Athletics"
        description="Gym identity, membership tier, and assigned coach license overview."
        actions={<Badge variant="accent">Gym Pro</Badge>}
      >
        <EmptyState
          title="Expanded gym profile modules are coming next."
          description="This surface stays aligned with the new system while organization profile controls remain in placeholder mode."
        />
      </PageHero>
    </main>
  );
}
