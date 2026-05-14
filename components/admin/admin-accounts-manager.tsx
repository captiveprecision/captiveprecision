"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Crown, Mail, Plus, ShieldCheck, UserRound, X } from "lucide-react";

import { Badge, Button, Card, CardContent, Input, Select, Tabs, Textarea } from "@/components/ui";

type AccountTab = "gyms" | "coaches" | "admins";
type InviteRole = "coach" | "gym" | "admin";

export type AdminGymAccount = {
  id: string;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  planLabel: string;
  membershipStatus: string;
  activeCoachLicenses: number;
  totalCoachLicenses: number;
  createdAt: string | null;
};

export type AdminCoachAccount = {
  id: string;
  name: string;
  email: string;
  accessStatus: string;
  organizationName: string | null;
  organizationStatus: "independent" | "gym_assigned";
  membershipLabel: string;
  createdAt: string | null;
};

export type AdminUserAccount = {
  id: string;
  name: string;
  email: string;
  accessStatus: string;
  createdAt: string | null;
};

export type AdminGymOption = {
  id: string;
  name: string;
};

type AdminAccountsManagerProps = {
  gyms: AdminGymAccount[];
  coaches: AdminCoachAccount[];
  admins: AdminUserAccount[];
  gymOptions: AdminGymOption[];
};

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

function statusVariant(status: string) {
  return status === "active" || status === "approved" ? "accent" : status === "pending" ? "subtle" : "neutral";
}

function EmptyAccountState({ title, description }: { title: string; description: string }) {
  return (
    <Card variant="subtle" className="admin-accounts-empty">
      <CardContent>
        <h3>{title}</h3>
        <p>{description}</p>
      </CardContent>
    </Card>
  );
}

export function AdminAccountsManager({ gyms, coaches, admins, gymOptions }: AdminAccountsManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AccountTab>("gyms");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [role, setRole] = useState<InviteRole>("coach");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [manualPremium, setManualPremium] = useState(false);
  const [gymId, setGymId] = useState("");
  const [gymName, setGymName] = useState("");
  const [internalLabel, setInternalLabel] = useState("");
  const [notes, setNotes] = useState("");

  const tabItems = useMemo(
    () => [
      { value: "gyms" as const, label: `Gym organizations (${gyms.length})` },
      { value: "coaches" as const, label: `Coaches (${coaches.length})` },
      { value: "admins" as const, label: `Admins (${admins.length})` }
    ],
    [admins.length, coaches.length, gyms.length]
  );

  function resetForm() {
    setRole("coach");
    setEmail("");
    setDisplayName("");
    setManualPremium(false);
    setGymId("");
    setGymName("");
    setInternalLabel("");
    setNotes("");
  }

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/accounts/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          displayName,
          role,
          manualPremium,
          gymId: role === "coach" ? gymId : "",
          gymName: role === "gym" ? gymName : "",
          internalLabel,
          notes
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to invite account.");
      }

      setNotice({ type: "success", message: payload.message ?? "Account invitation completed." });
      setModalOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to invite account."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card radius="panel">
        <CardContent className="admin-accounts-hero">
          <div className="admin-accounts-hero__copy">
            <span className="ui-section-header__eyebrow">Admin workspace</span>
            <h1>Account management</h1>
            <p>Review registered platform accounts, assign Gym access, and grant manual Premium when Stripe is not part of the workflow.</p>
          </div>
          <Button type="button" variant="primary" leadingIcon={<Plus size={18} />} onClick={() => setModalOpen(true)}>
            Add account
          </Button>
        </CardContent>
      </Card>

      {notice ? <p className={`admin-accounts-notice admin-accounts-notice--${notice.type}`}>{notice.message}</p> : null}

      <Card radius="panel">
        <CardContent className="admin-accounts-panel">
          <Tabs items={tabItems} value={activeTab} onValueChange={setActiveTab} ariaLabel="Account groups" className="admin-accounts-tabs" />

          {activeTab === "gyms" ? (
            gyms.length ? (
              <div className="admin-accounts-grid">
                {gyms.map((gym) => (
                  <article key={gym.id} className="admin-account-card">
                    <div className="admin-account-card__icon">
                      <Building2 size={22} />
                    </div>
                    <div className="admin-account-card__body">
                      <div className="admin-account-card__headline">
                        <h3>{gym.name}</h3>
                        <Badge variant={statusVariant(gym.membershipStatus)}>{gym.membershipStatus}</Badge>
                      </div>
                      <p>{gym.ownerName} / {gym.ownerEmail}</p>
                      <div className="admin-account-card__meta">
                        <span>{gym.planLabel}</span>
                        <span>{gym.activeCoachLicenses} active coach licenses</span>
                        <span>{gym.totalCoachLicenses} total seats</span>
                        <span>Created {formatDate(gym.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAccountState title="No Gym organizations yet." description="Gym accounts invited from here will appear in this list." />
            )
          ) : null}

          {activeTab === "coaches" ? (
            coaches.length ? (
              <div className="admin-accounts-grid">
                {coaches.map((coach) => (
                  <article key={coach.id} className="admin-account-card">
                    <div className="admin-account-card__icon">
                      <UserRound size={22} />
                    </div>
                    <div className="admin-account-card__body">
                      <div className="admin-account-card__headline">
                        <h3>{coach.name}</h3>
                        <Badge variant={coach.organizationStatus === "gym_assigned" ? "accent" : "subtle"}>
                          {coach.organizationStatus === "gym_assigned" ? "Gym assigned" : "Independent"}
                        </Badge>
                      </div>
                      <p>{coach.email}</p>
                      <div className="admin-account-card__meta">
                        <span>{coach.organizationName ?? "No Gym organization"}</span>
                        <span>{coach.membershipLabel}</span>
                        <span>{coach.accessStatus}</span>
                        <span>Created {formatDate(coach.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAccountState title="No coaches yet." description="Invited coach accounts will appear here, including their Gym assignment when present." />
            )
          ) : null}

          {activeTab === "admins" ? (
            admins.length ? (
              <div className="admin-accounts-grid">
                {admins.map((admin) => (
                  <article key={admin.id} className="admin-account-card">
                    <div className="admin-account-card__icon">
                      <ShieldCheck size={22} />
                    </div>
                    <div className="admin-account-card__body">
                      <div className="admin-account-card__headline">
                        <h3>{admin.name}</h3>
                        <Badge variant={statusVariant(admin.accessStatus)}>{admin.accessStatus}</Badge>
                      </div>
                      <p>{admin.email}</p>
                      <div className="admin-account-card__meta">
                        <span>Created {formatDate(admin.createdAt)}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyAccountState title="No admins yet." description="Additional admin accounts invited from here will be listed in this section." />
            )
          ) : null}
        </CardContent>
      </Card>

      {modalOpen ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !submitting && setModalOpen(false)}>
          <form className="admin-account-modal" role="dialog" aria-modal="true" aria-labelledby="admin-account-modal-title" onSubmit={submitInvite} onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Manual invitation</span>
                <h2 id="admin-account-modal-title">Add account</h2>
                <p>Supabase will send the invite email. The user sets their password from the activation link.</p>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close invite form" onClick={() => setModalOpen(false)} disabled={submitting}>
                <X size={18} />
              </Button>
            </div>

            <div className="admin-account-modal__grid">
              <Input id="account-email" type="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Input id="account-display-name" label="Display name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              <Select id="account-role" label="Role" value={role} onChange={(event) => setRole(event.target.value as InviteRole)}>
                <option value="coach">Coach</option>
                <option value="gym">Gym organization</option>
                <option value="admin">Admin</option>
              </Select>

              {role === "coach" ? (
                <Select id="account-gym" label="Gym association" value={gymId} onChange={(event) => setGymId(event.target.value)} placeholder="Independent coach">
                  {gymOptions.map((gym) => (
                    <option key={gym.id} value={gym.id}>{gym.name}</option>
                  ))}
                </Select>
              ) : null}

              {role === "gym" ? (
                <Input id="account-gym-name" label="Gym organization name" value={gymName} onChange={(event) => setGymName(event.target.value)} required />
              ) : null}

              <Input id="account-label" label="Internal label" value={internalLabel} onChange={(event) => setInternalLabel(event.target.value)} />
              <Textarea id="account-notes" label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} containerClassName="admin-account-modal__full" rows={3} />
            </div>

            <label className="admin-account-premium-toggle">
              <input type="checkbox" checked={manualPremium} onChange={(event) => setManualPremium(event.target.checked)} />
              <span>
                <strong><Crown size={16} /> Grant manual Premium</strong>
                <small>Creates an active manual membership without touching Stripe records.</small>
              </span>
            </label>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" leadingIcon={<Mail size={17} />} disabled={submitting}>
                {submitting ? "Sending invite..." : "Send invitation"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
