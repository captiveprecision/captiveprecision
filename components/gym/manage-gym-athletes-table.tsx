"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Ellipsis, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button, Input } from "@/components/ui";
import type { AgeCategoryEligibilityResult } from "@/lib/domain/age-category";

export type ManageGymAthleteParentContact = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type ManageGymAthleteTryout = {
  id: string;
  label: string;
  sport: string;
  occurredAt: string;
  seasonLabel: string;
  scoreLabel: string;
};

export type ManageGymAthleteTeamHistory = {
  id: string;
  seasonLabel: string;
  teamName: string;
  level: string;
  category: string;
};

export type ManageGymAthleteRow = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  registrationNumber: string;
  notes: string;
  parentContacts: ManageGymAthleteParentContact[];
  eligibility: AgeCategoryEligibilityResult;
  tryouts: ManageGymAthleteTryout[];
  teamHistory: ManageGymAthleteTeamHistory[];
};

type ManageGymAthletesTableProps = {
  canEditAthletes: boolean;
  initialAthletes: ManageGymAthleteRow[];
};

function emptyParentContact(index: number): ManageGymAthleteParentContact {
  return {
    id: `parent-${index + 1}`,
    name: "",
    email: "",
    phone: ""
  };
}

export function ManageGymAthletesTable({ canEditAthletes, initialAthletes }: ManageGymAthletesTableProps) {
  const router = useRouter();
  const [athletes, setAthletes] = useState(initialAthletes);
  const [expandedAthleteIds, setExpandedAthleteIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<ManageGymAthleteRow | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [parentContacts, setParentContacts] = useState<ManageGymAthleteParentContact[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setAthletes(initialAthletes);
  }, [initialAthletes]);

  function toggleExpandedAthlete(id: string) {
    setExpandedAthleteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openEdit(athlete: ManageGymAthleteRow) {
    setEditTarget(athlete);
    setFirstName(athlete.firstName);
    setLastName(athlete.lastName);
    setDateOfBirth(athlete.dateOfBirth);
    setRegistrationNumber(athlete.registrationNumber);
    setNotes(athlete.notes);
    setParentContacts(athlete.parentContacts.length ? athlete.parentContacts : [emptyParentContact(0)]);
    setNotice(null);
  }

  function updateParentContact(id: string, key: keyof Omit<ManageGymAthleteParentContact, "id">, value: string) {
    setParentContacts((current) => current.map((contact) => (
      contact.id === id ? { ...contact, [key]: value } : contact
    )));
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editTarget) {
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const normalizedRegistrationNumber = registrationNumber.trim();
      const response = await fetch("/api/gym/athletes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          athleteId: editTarget.id,
          firstName,
          lastName,
          dateOfBirth,
          registrationNumber: normalizedRegistrationNumber,
          notes,
          parentContacts
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "Unable to update athlete.");
      }

      const updatedAthlete = {
        ...editTarget,
        firstName,
        lastName,
        name: [firstName, lastName].filter(Boolean).join(" ").trim() || editTarget.name,
        dateOfBirth,
        registrationNumber: normalizedRegistrationNumber,
        notes,
        parentContacts: parentContacts.filter((contact) => contact.name || contact.email || contact.phone)
      };

      setAthletes((current) => current.map((athlete) => (
        athlete.id === editTarget.id ? updatedAthlete : athlete
      )));
      setEditTarget(null);
      setNotice({ type: "success", message: payload.message ?? "Athlete updated." });
      router.refresh();
    } catch (error) {
      setNotice({ type: "error", message: error instanceof Error ? error.message : "Unable to update athlete." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="manage-gym-card-header">
        <div>
          <div className="metric-label">Athletes</div>
          <p className="metric-subtext">Permanent athlete profiles, previous tryouts, and team history across seasons.</p>
        </div>
      </div>

      {notice ? <p className={`manage-gym-staff-notice manage-gym-staff-notice--${notice.type}`}>{notice.message}</p> : null}

      <div className="settings-data-table-wrap">
        <table className="settings-data-table manage-gym-athletes-table">
          <thead>
            <tr>
              <th scope="col">Athlete</th>
              <th scope="col">Registration</th>
              <th scope="col">Birth Date</th>
              <th scope="col">Tryouts</th>
            </tr>
          </thead>
          <tbody>
            {athletes.length ? (
              athletes.map((athlete) => (
                <ManageGymAthleteTableRow
                  key={athlete.id}
                  athlete={athlete}
                  canEditAthletes={canEditAthletes}
                  isExpanded={expandedAthleteIds.has(athlete.id)}
                  onEdit={openEdit}
                  onToggleExpanded={toggleExpandedAthlete}
                />
              ))
            ) : (
              <tr>
                <td colSpan={4}>No athletes found for this gym.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editTarget ? (
        <div className="admin-account-modal-backdrop" role="presentation" onClick={() => !submitting && setEditTarget(null)}>
          <form className="admin-account-modal manage-gym-action-modal" role="dialog" aria-modal="true" aria-labelledby="manage-gym-athlete-edit-title" onSubmit={submitEdit} onClick={(event) => event.stopPropagation()}>
            <div className="admin-account-modal__header">
              <div>
                <span className="ui-section-header__eyebrow">Athlete profile</span>
                <h2 id="manage-gym-athlete-edit-title">Edit {editTarget.name}</h2>
              </div>
              <Button type="button" variant="ghost" iconOnly aria-label="Close athlete edit form" onClick={() => setEditTarget(null)} disabled={submitting}>
                <X size={18} />
              </Button>
            </div>

            <div className="manage-gym-form-grid">
              <Input id="manage-gym-athlete-first-name" label="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
              <Input id="manage-gym-athlete-last-name" label="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              <Input id="manage-gym-athlete-birth-date" label="Birth date" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              <Input id="manage-gym-athlete-registration" label="Registration" value={registrationNumber} onChange={(event) => setRegistrationNumber(event.target.value)} />
            </div>

            <label className="ui-field">
              <span className="ui-field__label">Notes</span>
              <textarea className="ui-textarea" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>

            <div className="manage-gym-compact-editor" role="group" aria-labelledby="manage-gym-athlete-parents-label">
              <span id="manage-gym-athlete-parents-label" className="ui-field__label">Parent contacts</span>
              <div className="manage-gym-parent-contact-list">
                {parentContacts.map((contact) => (
                  <div key={contact.id} className="manage-gym-parent-contact-row">
                    <Input id={`${contact.id}-name`} label="Name" value={contact.name} onChange={(event) => updateParentContact(contact.id, "name", event.target.value)} />
                    <Input id={`${contact.id}-email`} label="Email" value={contact.email} onChange={(event) => updateParentContact(contact.id, "email", event.target.value)} />
                    <Input id={`${contact.id}-phone`} label="Phone" value={contact.phone} onChange={(event) => updateParentContact(contact.id, "phone", event.target.value)} />
                    <Button
                      type="button"
                      variant="ghost"
                      iconOnly
                      aria-label="Remove parent contact"
                      onClick={() => setParentContacts((current) => current.filter((item) => item.id !== contact.id))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leadingIcon={<Plus size={16} />}
                onClick={() => setParentContacts((current) => [...current, emptyParentContact(current.length)])}
              >
                Add Contact
              </Button>
            </div>

            <div className="admin-account-modal__actions">
              <Button type="button" variant="secondary" onClick={() => setEditTarget(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" leadingIcon={<Pencil size={16} />} disabled={submitting || !firstName.trim() || !lastName.trim()}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

type ManageGymAthleteTableRowProps = {
  athlete: ManageGymAthleteRow;
  canEditAthletes: boolean;
  isExpanded: boolean;
  onEdit: (athlete: ManageGymAthleteRow) => void;
  onToggleExpanded: (id: string) => void;
};

function ManageGymAthleteTableRow({
  athlete,
  canEditAthletes,
  isExpanded,
  onEdit,
  onToggleExpanded
}: ManageGymAthleteTableRowProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  return (
    <>
      <tr
        className="settings-data-table__expand-row"
        aria-expanded={isExpanded}
        onClick={() => onToggleExpanded(athlete.id)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpanded(athlete.id);
          }
        }}
      >
        <td><strong>{athlete.name}</strong></td>
        <td>{athlete.registrationNumber || "Not set"}</td>
        <td>{athlete.dateOfBirth || "Not set"}</td>
        <td>{athlete.tryouts.length}</td>
      </tr>
      {isExpanded ? (
        <tr className="settings-data-table__detail-row">
          <td colSpan={4}>
            <div className="manage-gym-person-details">
              {canEditAthletes ? (
                <div className="manage-gym-person-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Open actions for ${athlete.name}`}
                    leadingIcon={<Ellipsis size={18} />}
                    onClick={() => setActionMenuOpen((value) => !value)}
                  />
                  {actionMenuOpen ? (
                    <div className="manage-gym-person-action-menu">
                      <button
                        type="button"
                        onClick={() => {
                          setActionMenuOpen(false);
                          onEdit(athlete);
                        }}
                      >
                        <Pencil size={15} />
                        Edit
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="manage-gym-profile-row manage-gym-team-detail-grid">
                <div>
                  <span className="metric-label">Parents</span>
                  <strong>{athlete.parentContacts.length ? athlete.parentContacts.map((contact) => contact.name || contact.email || contact.phone).join(", ") : "Not set"}</strong>
                </div>
                <div>
                  <span className="metric-label">Notes</span>
                  <strong>{athlete.notes || "No notes"}</strong>
                </div>
              </div>
              <div className="manage-gym-history-grid">
                <section>
                  <span className="metric-label">Eligible Categories</span>
                  <AgeEligibilityBlock eligibility={athlete.eligibility} />
                </section>
                <section>
                  <span className="metric-label">Team history</span>
                  {athlete.teamHistory.length ? (
                    <ul className="manage-gym-history-list">
                      {athlete.teamHistory.map((item) => (
                        <li key={item.id}>
                          <strong>{item.seasonLabel}</strong>
                          <span>{item.teamName} / {item.level} / {item.category}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="metric-subtext">No team history yet.</p>
                  )}
                </section>
                <section>
                  <span className="metric-label">Previous tryouts</span>
                  {athlete.tryouts.length ? (
                    <ul className="manage-gym-history-list">
                      {athlete.tryouts.map((item) => (
                        <li key={item.id}>
                          <strong>{item.sport} / {item.scoreLabel}</strong>
                          <span>{item.seasonLabel} / {item.occurredAt}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="metric-subtext">No tryout records yet.</p>
                  )}
                </section>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AgeEligibilityBlock({ eligibility }: { eligibility: AgeCategoryEligibilityResult }) {
  if (eligibility.status === "missing-birth-date") {
    return <p className="metric-subtext">Birth date required to calculate eligibility.</p>;
  }

  if (eligibility.status === "invalid-birth-date") {
    return <p className="metric-subtext">Birth date is not valid enough to calculate eligibility.</p>;
  }

  if (eligibility.status === "missing-season") {
    return <p className="metric-subtext">No active Gym season is available.</p>;
  }

  if (eligibility.status === "missing-grid") {
    return <p className="metric-subtext">No active USASF grid found for {eligibility.seasonLabel ?? "this season"}.</p>;
  }

  if (!eligibility.categories.length) {
    return <p className="metric-subtext">No matching categories for birth year {eligibility.birthYear ?? "-"}.</p>;
  }

  return (
    <div className="age-eligibility-card">
      <span className="metric-subtext">{eligibility.seasonLabel} / birth year {eligibility.birthYear}</span>
      <div className="age-eligibility-card__badges">
        {eligibility.categories.map((category) => (
          <span key={category.id} className="status-pill status-pill--accent">{category.categoryName}</span>
        ))}
      </div>
    </div>
  );
}
