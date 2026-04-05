import { Card, CardContent } from "@/components/ui";

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="landing-shell page-stack pwa-offline-page">
      <Card className="pwa-offline-card" radius="panel">
        <CardContent className="pwa-offline-card__content">
          <p className="metric-label">Offline</p>
          <h1 className="page-title">You are currently offline</h1>
          <p className="muted-copy">
            Installed screens and locally saved tool data remain available. Sign-in and synced updates will resume once the connection returns.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
