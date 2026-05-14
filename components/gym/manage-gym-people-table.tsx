"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, UserRound, X } from "lucide-react";

import { Button, Input, Select } from "@/components/ui";

const ROLE_OPTIONS = ["Coach", "Staff", "Assistant"] as const;

type ManageGymRole = (typeof ROLE_OPTIONS)[number] | "";
type StaffSeatRole = "coach" | "staff" | "assistant";
type LookupStatus = "idle" | "loading" | "found" | "not-found" | "error";

export type ManageGymPerson = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  role: ManageGymRole;
  staffFunction: string;
  credentialLevels: string[];
  membershipAssigned: boolean;
  membershipLabel: string;
  teams: string;
  classes: string;
};

type ManageGymPeopleTableProps = {
  initialPeople: ManageGymPerson[];
};

type StaffLookupProfile = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  alreadyLinked: boolean;
};

function toSeatRole(value: ManageGymRole | StaffSeatRole): StaffSeatRole {
  switch (value) {
    case "Staff":
    case "staff":
      return "staff";
    case "Assistant":
    case "assistant":
      return "assistant";
    case "Coach":
    case "coach":
    default:
      return "coach";
  }
}

function toManageGymRole(value: StaffSeatRole): ManageGymRole {
  switch (value) {
    case "staff":
      return "Staff";
    case "assistant":
      return "Assistant";
    case "coach":
    default:
      return "Coach";
  }
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildOptimisticPerson(payload: {
  accountId: string;
  email: string;
  displayName: string;
  seatRole: StaffSeatRole;
  invitationSent?: boolean;
}): ManageGymPerson {
  return {
    id: payload.accountId,
    name: payload.displayName || payload.email,
    email: payload.email,
    joinedAt: new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date()),
    role: toManageGymRole(payload.seatRole),
    staffFunction: payload.seatRole === "staff" ? "Program staff" : "",
    credentialLevels: [],
    membershipAssigned: true,
    membershipLabel: payload.invitationSent ? "Invitation Sent" : "Gym Access Active",
    teams: "No teams",
    classes: "No classes"
  };
}

export function ManageGymPeopleTable({ initialPeople }: ManageGymPeopleTableProps) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  const [expandedPersonIds, setExpandedPersonIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupProfile, setLookupProfile] = useState<StaffLookupProfile | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [existingSeatRole, setExistingSeatRole] = useState<StaffSeatRole>("staff");
  const [inviteFormOpen, setInviteFormOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<StaffSeatRole>("staff");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const activePeople = useMemo(
    () => people.filter((person) => person.role && person.membershipAssigned),
    [people]
  );
  const peopleNeedingAccess = useMemo(
    () => people.filter((person) => !person.role || !person.membershipAssigned),
    [people]
  );

  useEffect(() => {
    setPeople(initialPeople);
  }, [initialPeople]);

  function updatePerson(id: string, patch: Partial<ManageGymPerson>) {
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  function assignMembership(id: string) {
    updatePerson(id, {
      membershipAssigned: true,
      membershipLabel: "Manual Membership"
    });
  }

  function toggleExpandedPerson(id: string) {
    setExpandedPersonIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function resetInviteState() {
    setEmail("");
    setLookupStatus("idle");
    setLookupProfile(null);
    setLookupError("");
    setExistingSeatRole("staff");
    setInviteFormOpen(false);
    setInviteName("");
    setInviteRole("staff");
    setNotice(null);
  }

  function closeModal() {
    if (submitting) {
      return;
    }

    setModalOpen(false);
    resetInviteState();
  }

  function upsertLocalPerson(person: ManageGymPerson) {
    setPeople((current) => {
      const existingIndex = current.findIndex((currentPerson) => currentPerson.id === person.id);

      if (existingIndex === -1) {
        return [person, ...current];
      }

      return current.map((currentPerson) => (currentPerson.id === person.id ? { ...currentPerson, ...person } : currentPerson));
    });
  }

  async function submitStaffInvite(payload: { email: string; displayName: string; seatRole: StaffSeatRole; profileId?: string }) {
    setSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/gym/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof responsePayload.error === "string" ? responsePayload.error : "Unable to add staff.");
      }

      const person = buildOptimisticPerson({
        accountId: responsePayload.accountId,
        email: responsePayload.email ?? payload.email,
        displayName: responsePayload.displayName ?? payload.displayName,
        seatRole: responsePayload.seatRole ?? payload.seatRole,
        invitationSent: Boolean(responsePayload.invitationSent)
      });

      upsertLocalPerson(person);
      setNotice({ type: "success", message: responsePayload.message ?? "Staff access updated." });
      setTimeout(() => {
        setModalOpen(false);
        resetInviteState();
        router.refresh();
      }, 450);
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to add staff." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExistingProfile() {
    if (!lookupProfile || lookupProfile.alreadyLinked) {
      return;
    }

    await submitStaffInvite({
      email: lookupProfile.email,
      displayName: lookupProfile.displayName,
      seatRole: existingSeatRole,
      profileId: lookupProfile.id
    });
  }

  async function submitNewInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await submitStaffInvite({
      email,
      displayName: inviteName,
      seatRole: inviteRole
    });
  }

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLookupStatus("idle");
      setLookupProfile(null);
      setLookupError("");
      setInviteFormOpen(false);
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setLookupStatus("idle");
      setLookupProfile(null);
      setLookupError("");
      setInviteFormOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLookupStatus("loading");
      setLookupProfile(null);
      setLookupError("");

      try {
        const response = await fetch(`/api/gym/staff?email=${encodeURIComponent(normalizedEmail)}`, {
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Unable to search for this email.");
        }

        if (payload.profile) {
          setLookupProfile(payload.profile);
          setExistingSeatRole("staff");
          setLookupStatus("found");
          setInviteFormOpen(false);
          return;
        }

        setLookupStatus("not-found");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLookupStatus("error");
        setLookupError(error instanceof Error ? error.message : "Unable to search for this email.");
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [email]);

  return (
    <>
      <div className="manage-gym-card-header">
        <div>
          <div className="metric-label">Coaches And Staff</div>
          <p>Manage gym access for coaches, assistants, and staff.</p>
        </div>
        <Button type="button" variant="primary" leadingIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
          Add Staff
        </Button>
      </div>

      {notice && !modalOpen ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}

      <div className="settings-data-table-wrap">
        <table className="settings-data-table">
          <colgroup>
            <col className="manage-gym-table-col-name" />
            <col className="manage-gym-table-col-role" />
            <col className="manage-gym-table-col-teams" />
            <col className="manage-gym-table-col-classes" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Teams</th>
              <th scope="col">Classes</th>
            </tr>
          </thead>
          <tbody>
            {activePeople.length ? (
              activePeople.map((person) => (
                <ManageGymPeopleRow
                  key={person.id}
                  person={person}
                  isExpanded={expandedPersonIds.has(person.id)}
                  onAssignMembership={assignMembership}
                  onToggleExpanded={toggleExpandedPerson}
                  onUpdatePerson={updatePerson}
                />
              ))
            ) : (
              <tr>
                <td colSpan={4}>No active coaches or staff yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {peopleNeedingAccess.length ? (
        <div className="manage-gym-unassigned">
          <div className="metric-label">Staff Without Roles</div>
          <div className="settings-data-table-wrap">
            <table className="settings-data-table settings-data-table--compact">
              <colgroup>
                <col className="manage-gym-table-col-name" />
                <col className="manage-gym-table-col-role" />
                <col className="manage-gym-table-col-teams" />
                <col className="manage-gym-table-col-classes" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Teams</th>
                  <th scope="col">Classes</th>
                </tr>
              </thead>
              <tbody>
                {peopleNeedingAccess.map((person) => (
                  <ManageGymPeopleRow
                    key={person.id}
                    person={person}
                    isPendingAccess
                    isExpanded={expandedPersonIds.has(person.id)}
                    onAssignMembership={assignMembership}
                    onToggleExpanded={toggleExpandedPerson}
                    onUpdatePerson={updatePerson}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={closeModal}>
          <div className="admin-account-modal manage-gym-staff-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-staff-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Gym access</span>
                <h2 id="manage-gym-staff-modal-title">Add staff</h2>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close staff form" onClick={closeModal} disabled={submitting}>
                <X size={18} />
              </Button>
            </div>

            <Input
              id="staff-email-search"
              type="email"
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="coach@example.com"
              autoComplete="email"
            />

            {lookupStatus === "loading" ? <p className="manage-gym-staff-search-state">Searching registered accounts...</p> : null}
            {lookupStatus === "error" ? <p className="manage-gym-staff-notice manage-gym-staff-notice--error">{lookupError}</p> : null}

            {lookupStatus === "found" && lookupProfile ? (
              <div className="manage-gym-staff-result">
                <div className="manage-gym-staff-result__icon">
                  <UserRound size={20} />
                </div>
                <div>
                  <span className="metric-label">Registered account</span>
                  <strong>{lookupProfile.displayName}</strong>
                  <p>{lookupProfile.email}</p>
                </div>
                <Select
                  aria-label="Gym role"
                  value={existingSeatRole}
                  onChange={(event) => setExistingSeatRole(event.target.value as StaffSeatRole)}
                  disabled={lookupProfile.alreadyLinked || submitting}
                >
                  <option value="staff">Staff</option>
                  <option value="coach">Coach</option>
                  <option value="assistant">Assistant</option>
                </Select>
                <Button type="button" onClick={() => void submitExistingProfile()} disabled={lookupProfile.alreadyLinked || submitting}>
                  {lookupProfile.alreadyLinked ? "Already Added" : submitting ? "Adding..." : "Add To Gym"}
                </Button>
              </div>
            ) : null}

            {lookupStatus === "not-found" ? (
              <div className="manage-gym-staff-create">
                <p>No registered account was found for this email.</p>
                {!inviteFormOpen ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setInviteName("");
                      setInviteRole("staff");
                      setInviteFormOpen(true);
                    }}
                  >
                    Create New Account
                  </Button>
                ) : null}
              </div>
            ) : null}

            {inviteFormOpen ? (
              <form className="manage-gym-staff-invite-form" onSubmit={submitNewInvite}>
                <Input id="staff-invite-email" type="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <Input id="staff-invite-name" label="Name" value={inviteName} onChange={(event) => setInviteName(event.target.value)} required />
                <Select id="staff-invite-role" label="Role" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffSeatRole)}>
                  <option value="staff">Staff</option>
                  <option value="coach">Coach</option>
                  <option value="assistant">Assistant</option>
                </Select>
                <div className="admin-account-modal__actions">
                  <Button type="button" variant="secondary" onClick={() => setInviteFormOpen(false)} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" leadingIcon={<Mail size={16} />} disabled={submitting || !isValidEmail(email) || !inviteName.trim()}>
                    {submitting ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            ) : null}

            {notice ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

type ManageGymPeopleRowProps = {
  person: ManageGymPerson;
  isPendingAccess?: boolean;
  isExpanded: boolean;
  onAssignMembership: (id: string) => void;
  onToggleExpanded: (id: string) => void;
  onUpdatePerson: (id: string, patch: Partial<ManageGymPerson>) => void;
};

function ManageGymPeopleRow({
  person,
  isPendingAccess = false,
  isExpanded,
  onAssignMembership,
  onToggleExpanded,
  onUpdatePerson
}: ManageGymPeopleRowProps) {
  const membershipText = person.membershipAssigned ? person.membershipLabel : "Membership not assigned";
  const actionLabel = person.membershipAssigned ? "Membership Assigned" : "Assign Membership";
  const canMoveToActive = Boolean(person.role);

  return (
    <>
      <tr
        className="settings-data-table__expand-row"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpanded(person.id)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpanded(person.id);
          }
        }}
      >
        <td>
          <strong>{person.name}</strong>
        </td>
        <td>{person.role || "Unassigned"}</td>
        <td>{person.teams}</td>
        <td>{person.classes}</td>
      </tr>
      {isExpanded ? (
        <tr className="settings-data-table__detail-row">
          <td colSpan={4}>
            <div className="manage-gym-person-details">
              <div className="manage-gym-profile-details">
                <div>
                  <span className="metric-label">Registered Email</span>
                  <strong>{person.email}</strong>
                </div>
                <div>
                  <span className="metric-label">Date Joined</span>
                  <strong>{person.joinedAt}</strong>
                </div>
                <div>
                  <span className="metric-label">USASF Credentials</span>
                  <strong>{person.credentialLevels.length ? person.credentialLevels.join(", ") : "Not recorded"}</strong>
                </div>
              </div>
              <div className="manage-gym-role-cell">
                <span className="metric-label">Role</span>
                <Select
                  aria-label={`Role for ${person.name}`}
                  value={person.role}
                  placeholder="Select role"
                  onChange={(event) => {
                    const role = event.target.value as ManageGymRole;
                    onUpdatePerson(person.id, {
                      role,
                      staffFunction: role === "Staff" ? person.staffFunction || "Program staff" : ""
                    });
                  }}
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                {person.role === "Staff" ? (
                  <input
                    aria-label={`Staff function for ${person.name}`}
                    className="ui-input"
                    value={person.staffFunction}
                    placeholder="Staff function"
                    onChange={(event) => onUpdatePerson(person.id, { staffFunction: event.target.value })}
                  />
                ) : null}
              </div>
              <div className="manage-gym-membership-details">
                <div>
                  <span className="metric-label">Membership</span>
                  <strong>{isPendingAccess && !person.role ? "Role and membership needed" : membershipText}</strong>
                </div>
                <Button
                  size="sm"
                  variant={person.membershipAssigned ? "secondary" : "primary"}
                  disabled={person.membershipAssigned || !canMoveToActive}
                  onClick={() => onAssignMembership(person.id)}
                >
                  {actionLabel}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
