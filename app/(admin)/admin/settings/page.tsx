import { Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";

export default function AdminSettingsPage() {
  return (
    <main className="workspace-shell page-stack">
      <Card radius="panel" className="settings-hero">
        <CardContent className="settings-hero">
          <SectionHeader
            eyebrow="Admin settings"
            title="Settings"
            description="Administrative configuration surfaces will expand here as platform controls move out of placeholder mode."
          />
          <EmptyState
            title="Settings modules are coming next."
            description="This placeholder stays aligned with the new system while admin configuration is still being defined."
          />
        </CardContent>
      </Card>
    </main>
  );
}
