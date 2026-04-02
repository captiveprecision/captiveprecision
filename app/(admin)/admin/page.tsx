import { revalidatePath } from "next/cache";

import { Badge, Button, Card, CardContent, EmptyState, SectionHeader } from "@/components/ui";
import { requireAuthSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types/database";

type PendingBetaRequest = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "display_name" | "email" | "role" | "created_at" | "beta_requested_at"
>;

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

async function reviewBetaRequest(formData: FormData) {
  "use server";

  const session = await requireAuthSession("admin");
  const profileId = String(formData.get("profileId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();

  if (!profileId || (decision !== "approve" && decision !== "reject")) {
    return;
  }

  const admin = createAdminClient();
  await admin
    .from("profiles" as never)
    .update({
      beta_access_status: decision === "approve" ? "approved" : "rejected",
      beta_reviewed_at: new Date().toISOString(),
      beta_reviewed_by: session.userId
    } as never)
    .eq("id", profileId as never);

  revalidatePath("/admin");
}

export default async function AdminDashboardPage() {
  await requireAuthSession("admin");

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles" as never)
    .select("id, display_name, email, role, created_at, beta_requested_at" as never)
    .eq("beta_access_status", "pending")
    .order("beta_requested_at", { ascending: true });

  const pendingRequests = (data ?? []) as PendingBetaRequest[];

  return (
    <main className="workspace-shell page-stack admin-beta-shell">
      <Card radius="panel">
        <CardContent className="admin-beta-hero">
          <SectionHeader
            eyebrow="Admin dashboard"
            title="Beta access approvals"
            description="Review incoming beta requests before new users can sign in to the platform."
            actions={<Badge variant="accent">{pendingRequests.length} pending</Badge>}
          />
        </CardContent>
      </Card>

      <Card radius="panel">
        <CardContent className="admin-beta-panel">
          <SectionHeader
            eyebrow="Approval queue"
            title="Pending requests"
            description="Approve users to activate login access or reject requests that should remain blocked."
          />

          {pendingRequests.length ? (
            <div className="admin-beta-list">
              {pendingRequests.map((request) => (
                <article key={request.id} className="admin-beta-row">
                  <div className="admin-beta-row__copy">
                    <div className="admin-beta-row__headline">
                      <h3>{request.display_name ?? request.email ?? "Unnamed request"}</h3>
                      <Badge variant="subtle">{request.role}</Badge>
                    </div>
                    <p>{request.email ?? "No email address provided."}</p>
                    <div className="admin-beta-row__meta">
                      <span>Requested {formatDate(request.beta_requested_at ?? request.created_at)}</span>
                    </div>
                  </div>
                  <form action={reviewBetaRequest} className="admin-beta-row__actions">
                    <input type="hidden" name="profileId" value={request.id} />
                    <Button type="submit" name="decision" value="approve" variant="primary">
                      Approve
                    </Button>
                    <Button type="submit" name="decision" value="reject" variant="danger">
                      Reject
                    </Button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending beta requests."
              description="New access requests will appear here as soon as they are submitted from the landing page."
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
