"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ellipsis, Mail, Pencil, Plus, Unlink, UserRound, X } from "lucide-react";

import { Button, Input, Select } from "@/components/ui";

const ROLE_OPTIONS = ["Coach", "Staff", "Assistant"] as const;
const CREDENTIAL_OPTIONS = ["Tumbling", "Building", "Special Needs", "Dance"] as const;
const TUMBLING_LEVEL_OPTIONS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6"] as const;
const BUILDING_LEVEL_OPTIONS = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7"] as const;

type ManageGymRole = (typeof ROLE_OPTIONS)[number] | "";
type StaffSeatRole = "coach" | "staff" | "assistant";
type StaffCredential = (typeof CREDENTIAL_OPTIONS)[number];
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

function parseCredentialDetails(credentials: string[]) {
  const tumblingPrefix = "Tumbling max:";
  const buildingPrefix = "Building max:";
  const tumblingLevel = credentials.find((credential) => credential.startsWith(tumblingPrefix))?.replace(tumblingPrefix, "").trim();
  const buildingLevel = credentials.find((credential) => credential.startsWith(buildingPrefix))?.replace(buildingPrefix, "").trim();

  return CREDENTIAL_OPTIONS
    .filter((credential) => credentials.includes(credential))
    .map((credential) => {
      if (credential === "Tumbling" && tumblingLevel) {
        return `Tumbling ${tumblingLevel}`;
      }

      if (credential === "Building" && buildingLevel) {
        return `Building ${buildingLevel}`;
      }

      return credential;
    });
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
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<ManageGymPerson | null>(null);
  const [editRole, setEditRole] = useState<StaffSeatRole>("coach");
  const [editCredentials, setEditCredentials] = useState<StaffCredential[]>([]);
  const [editTumblingLevel, setEditTumblingLevel] = useState("");
  const [editBuildingLevel, setEditBuildingLevel] = useState("");
  const [editMembershipAssigned, setEditMembershipAssigned] = useState(true);
  const [unlinkTarget, setUnlinkTarget] = useState<ManageGymPerson | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const activePeople = useMemo(
    () => people.filter((person) => person.membershipAssigned),
    [people]
  );
  const peopleNeedingAccess = useMemo(
    () => people.filter((person) => !person.membershipAssigned),
    [people]
  );

  useEffect(() => {
    setPeople(initialPeople);
  }, [initialPeople]);

  function updatePerson(id: string, patch: Partial<ManageGymPerson>) {
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  function openEditModal(person: ManageGymPerson) {
    const tumblingPrefix = "Tumbling max:";
    const buildingPrefix = "Building max:";
    const tumblingLevel = person.credentialLevels
      .find((credential) => credential.startsWith(tumblingPrefix))
      ?.replace(tumblingPrefix, "")
      .trim() ?? "";
    const buildingLevel = person.credentialLevels
      .find((credential) => credential.startsWith(buildingPrefix))
      ?.replace(buildingPrefix, "")
      .trim() ?? "";

    setEditTarget(person);
    setEditRole(toSeatRole(person.role));
    setEditCredentials(person.credentialLevels.filter((credential): credential is StaffCredential =>
      CREDENTIAL_OPTIONS.includes(credential as StaffCredential)
    ));
    setEditTumblingLevel(tumblingLevel);
    setEditBuildingLevel(buildingLevel);
    setEditMembershipAssigned(person.membershipAssigned);
    setNotice(null);
  }

  function toggleEditCredential(credential: StaffCredential) {
    setEditCredentials((current) => (
      current.includes(credential)
        ? current.filter((item) => item !== credential)
        : [...current, credential]
    ));

    if (credential === "Tumbling" && editCredentials.includes("Tumbling")) {
      setEditTumblingLevel("");
    }

    if (credential === "Building" && editCredentials.includes("Building")) {
      setEditBuildingLevel("");
    }
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    setActionSubmitting(true);
    setNotice(null);

    try {
      const credentialLevels = [
        ...editCredentials,
        ...(editCredentials.includes("Tumbling") && editTumblingLevel.trim()
          ? [`Tumbling max: ${editTumblingLevel.trim()}`]
          : []),
        ...(editCredentials.includes("Building") && editBuildingLevel.trim()
          ? [`Building max: ${editBuildingLevel.trim()}`]
          : [])
      ];
      const response = await fetch("/api/gym/staff", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          profileId: editTarget.id,
          seatRole: editRole,
          credentialLevels,
          membershipAssigned: editMembershipAssigned
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to update staff details.");
      }

      updatePerson(editTarget.id, {
        role: toManageGymRole(editRole),
        staffFunction: editRole === "staff" ? editTarget.staffFunction || "Program staff" : "",
        credentialLevels,
        membershipAssigned: editMembershipAssigned,
        membershipLabel: editMembershipAssigned ? "Gym Access Active" : "View Only"
      });
      setNotice({ type: "success", message: payload.message ?? "Staff details updated." });
      setEditTarget(null);
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update staff details." });
    } finally {
      setActionSubmitting(false);
    }
  }

  async function confirmUnlink() {
    if (!unlinkTarget) {
      return;
    }

    setActionSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/gym/staff", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ profileId: unlinkTarget.id })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to unlink this account.");
      }

      setPeople((current) => current.filter((person) => person.id !== unlinkTarget.id));
      setExpandedPersonIds((current) => {
        const next = new Set(current);
        next.delete(unlinkTarget.id);
        return next;
      });
      setNotice({ type: "success", message: payload.message ?? "Account unlinked from this Gym." });
      setUnlinkTarget(null);
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to unlink this account." });
    } finally {
      setActionSubmitting(false);
    }
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
        </div>
        <Button type="button" variant="ghost" size="sm" leadingIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
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
                  onEdit={openEditModal}
                  onUnlink={setUnlinkTarget}
                  onToggleExpanded={toggleExpandedPerson}
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
                    isExpanded={expandedPersonIds.has(person.id)}
                    onEdit={openEditModal}
                    onUnlink={setUnlinkTarget}
                    onToggleExpanded={toggleExpandedPerson}
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

      {editTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !actionSubmitting && setEditTarget(null)}>
          <form className="admin-account-modal manage-gym-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-edit-title" onSubmit={submitEdit} onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Staff settings</span>
                <h2 id="manage-gym-edit-title">Edit {editTarget.name}</h2>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close edit form" onClick={() => setEditTarget(null)} disabled={actionSubmitting}>
                <X size={18} />
              </Button>
            </div>

            <Select id="staff-edit-role" label="Role" value={editRole} onChange={(event) => setEditRole(event.target.value as StaffSeatRole)}>
              <option value="staff">Staff</option>
              <option value="coach">Coach</option>
              <option value="assistant">Assistant</option>
            </Select>
            <div className="manage-gym-credential-options" role="group" aria-labelledby="staff-edit-credentials-label">
              <span id="staff-edit-credentials-label" className="ui-field__label">Credentials</span>
              <div className="manage-gym-credential-options__grid">
                {CREDENTIAL_OPTIONS.map((credential) => (
                  <label key={credential} className="manage-gym-credential-option">
                    <input
                      type="checkbox"
                      checked={editCredentials.includes(credential)}
                      onChange={() => toggleEditCredential(credential)}
                    />
                    <span>{credential}</span>
                  </label>
                ))}
              </div>
            </div>
            {editCredentials.includes("Tumbling") ? (
              <div className="manage-gym-tumbling-level-field">
                <Select
                  id="staff-edit-tumbling-level"
                  label="Maximum approved tumbling level"
                  value={editTumblingLevel}
                  onChange={(event) => setEditTumblingLevel(event.target.value)}
                  placeholder="Select max level"
                >
                  {TUMBLING_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </Select>
              </div>
            ) : null}
            {editCredentials.includes("Building") ? (
              <div className="manage-gym-tumbling-level-field">
                <Select
                  id="staff-edit-building-level"
                  label="Maximum approved building level"
                  value={editBuildingLevel}
                  onChange={(event) => setEditBuildingLevel(event.target.value)}
                  placeholder="Select max level"
                >
                  {BUILDING_LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </Select>
              </div>
            ) : null}
            <label className="manage-gym-membership-toggle">
              <input
                type="checkbox"
                checked={editMembershipAssigned}
                onChange={(event) => setEditMembershipAssigned(event.target.checked)}
              />
              <span>
                <strong>Membership assigned</strong>
                <small>Allows this user to access Gym tools and functions.</small>
              </span>
            </label>

            {!editMembershipAssigned ? (
              <p className="manage-gym-membership-warning">
                This user will lose access to Gym functions and tools. They will only be able to view.
              </p>
            ) : null}

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)} disabled={actionSubmitting}>
                Cancel
              </Button>
              <Button type="submit" leadingIcon={<Pencil size={16} />} disabled={actionSubmitting}>
                {actionSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {unlinkTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !actionSubmitting && setUnlinkTarget(null)}>
          <div className="admin-account-modal manage-gym-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-unlink-title" onClick={(event) => event.stopPropagation()}>
            <div className="manage-gym-warning-head">
              <span className="manage-gym-warning-icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </span>
              <div>
                <span className="ui-section-header__eyebrow">Warning</span>
                <h2 id="manage-gym-unlink-title">Unlink {unlinkTarget.name}?</h2>
                <p>This will remove this user from the Gym organization and detach them from organization team assignments. Are you sure?</p>
              </div>
            </div>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setUnlinkTarget(null)} disabled={actionSubmitting}>
                Cancel
              </Button>
              <Button type="button" variant="danger" leadingIcon={<Unlink size={16} />} onClick={() => void confirmUnlink()} disabled={actionSubmitting}>
                {actionSubmitting ? "Unlinking..." : "Unlink Account"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

type ManageGymPeopleRowProps = {
  person: ManageGymPerson;
  isExpanded: boolean;
  onEdit: (person: ManageGymPerson) => void;
  onUnlink: (person: ManageGymPerson) => void;
  onToggleExpanded: (id: string) => void;
};

function ManageGymPeopleRow({
  person,
  isExpanded,
  onEdit,
  onUnlink,
  onToggleExpanded
}: ManageGymPeopleRowProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const actionLabel = person.membershipAssigned ? "Assigned" : "View only";
  const credentialBullets = parseCredentialDetails(person.credentialLevels);

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
              <div className="manage-gym-person-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={`Open actions for ${person.name}`}
                  leadingIcon={<Ellipsis size={18} />}
                  onClick={() => setActionMenuOpen((value) => !value)}
                />
                {actionMenuOpen ? (
                  <div className="manage-gym-person-action-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false);
                        onEdit(person);
                      }}
                    >
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="manage-gym-person-action-menu__danger"
                      onClick={() => {
                        setActionMenuOpen(false);
                        onUnlink(person);
                      }}
                    >
                      <Unlink size={15} />
                      Unlink account
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="manage-gym-profile-details">
                <div className="manage-gym-profile-row">
                  <div>
                    <span className="metric-label">Email</span>
                    <strong>{person.email}</strong>
                  </div>
                  <div>
                    <span className="metric-label">Date Joined</span>
                    <strong>{person.joinedAt}</strong>
                  </div>
                </div>
                <div>
                  <span className="metric-label">USASF Credentials</span>
                  {credentialBullets.length ? (
                    <ul className="manage-gym-credential-bullets">
                      {credentialBullets.map((credential) => (
                        <li key={credential}>{credential}</li>
                      ))}
                    </ul>
                  ) : (
                    <strong>Not recorded</strong>
                  )}
                </div>
              </div>
              <div className="manage-gym-person-admin-row">
                <div className="manage-gym-membership-details">
                  <div>
                    <span className="metric-label">Role</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="manage-gym-status-button"
                    disabled
                  >
                    {person.role || "Unassigned"}
                  </Button>
                  {person.role === "Staff" && person.staffFunction ? <span>{person.staffFunction}</span> : null}
                </div>
                <div className="manage-gym-membership-details">
                  <div>
                    <span className="metric-label">Membership</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="manage-gym-status-button"
                    disabled
                  >
                    {actionLabel}
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
