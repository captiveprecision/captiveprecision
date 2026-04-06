import type { AthleteParentContact, AthleteRecord } from "@/lib/domain/athlete";
import type { AppRole, AuthSession } from "@/lib/auth/session";
import type { PlannerLevelLabel } from "@/lib/domain/planner-levels";
import type { PlannerProject } from "@/lib/domain/planner-project";
import type { TeamRecord } from "@/lib/domain/team";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/types/database";

type TeamRow = Database["public"]["Tables"]["teams"]["Row"];
type TeamCoachRow = Database["public"]["Tables"]["team_coaches"]["Row"];
type AthleteRow = Database["public"]["Tables"]["athletes"]["Row"];
type AthleteAssignmentRow = Database["public"]["Tables"]["athlete_team_assignments"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

type TeamMetadata = {
  teamLevel?: string;
  ageCategory?: string;
  trainingDays?: string;
  trainingHours?: string;
  assignedCoachNames?: string[];
  linkedCoachIds?: string[];
};

type AthleteMetadata = {
  registrationNumber?: string;
  notes?: string;
  parentContacts?: AthleteParentContact[];
  createdByProfileId?: string;
};

export type PlannerRemoteFoundationSnapshot = {
  athletes: AthleteRecord[];
  teams: TeamRecord[];
};

const DEFAULT_WORKSPACE_ID = "local-workspace";
const AGE_CATEGORY_FALLBACK = "Youth";
const TEAM_LEVEL_FALLBACK: PlannerLevelLabel = "Beginner";

function asObject(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

function parseParentContacts(value: unknown): AthleteParentContact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((contact, index) => {
    if (!contact || typeof contact !== "object" || Array.isArray(contact)) {
      return [];
    }

    const row = contact as Record<string, unknown>;

    return [{
      id: asString(row.id) || `parent-contact-${index + 1}`,
      name: asString(row.name),
      email: asString(row.email),
      phone: asString(row.phone)
    }];
  });
}

function parseTeamLevel(value: unknown): PlannerLevelLabel {
  return (
    value === "Beginner"
    || value === "Level 1"
    || value === "Level 2"
    || value === "Level 3"
    || value === "Level 4"
    || value === "Level 5"
    || value === "Level 6"
    || value === "Level 7"
  ) ? value : TEAM_LEVEL_FALLBACK;
}

function buildAthleteRecord(row: AthleteRow): AthleteRecord {
  const metadata = asObject(row.metadata) as AthleteMetadata;
  const firstName = row.first_name.trim();
  const lastName = row.last_name.trim();

  return {
    id: row.id,
    workspaceId: DEFAULT_WORKSPACE_ID,
    registrationNumber: asString(metadata.registrationNumber) || row.id.slice(0, 8).toUpperCase(),
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ").trim(),
    dateOfBirth: row.birth_date ?? "",
    notes: asString(metadata.notes),
    parentContacts: parseParentContacts(metadata.parentContacts),
    status: "active",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildTeamRecord(
  row: TeamRow,
  coachRows: TeamCoachRow[],
  athleteAssignments: AthleteAssignmentRow[],
  athleteMap: Map<string, AthleteRecord>
): TeamRecord {
  const metadata = asObject(row.metadata) as TeamMetadata;
  const linkedCoachIds = asStringArray(metadata.linkedCoachIds);
  const memberAthleteIds = athleteAssignments
    .filter((assignment) => assignment.team_id === row.id)
    .map((assignment) => assignment.athlete_id);

  return {
    id: row.id,
    workspaceId: DEFAULT_WORKSPACE_ID,
    remoteTeamId: row.id,
    name: row.name.trim(),
    teamLevel: parseTeamLevel(metadata.teamLevel),
    teamType: asString(metadata.ageCategory) || AGE_CATEGORY_FALLBACK,
    teamDivision: asString(row.division),
    trainingDays: asString(metadata.trainingDays),
    trainingHours: asString(metadata.trainingHours),
    trainingSchedule: [asString(metadata.trainingDays), asString(metadata.trainingHours)].filter(Boolean).join(" / "),
    assignedCoachNames: asStringArray(metadata.assignedCoachNames),
    linkedCoachIds: linkedCoachIds.length ? linkedCoachIds : coachRows.filter((coach) => coach.team_id === row.id).map((coach) => coach.coach_profile_id),
    memberAthleteIds,
    memberRegistrationNumbers: memberAthleteIds
      .map((athleteId) => athleteMap.get(athleteId)?.registrationNumber ?? "")
      .filter(Boolean),
    status: "draft",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function findExistingTeam(project: PlannerProject, remoteTeam: TeamRecord) {
  return project.teams.find((team) => (
    team.remoteTeamId === remoteTeam.remoteTeamId
    || team.id === remoteTeam.remoteTeamId
  )) ?? null;
}

function mergeRemoteTeams(project: PlannerProject, remoteTeams: TeamRecord[]) {
  const mergedRemoteTeams = remoteTeams.map((remoteTeam) => {
    const existingTeam = findExistingTeam(project, remoteTeam);

    if (!existingTeam) {
      return remoteTeam;
    }

    return {
      ...remoteTeam,
      id: existingTeam.id,
      remoteTeamId: remoteTeam.remoteTeamId ?? existingTeam.remoteTeamId ?? remoteTeam.id
    };
  });

  const mergedRemoteIds = new Set(mergedRemoteTeams.map((team) => team.remoteTeamId || team.id));
  const localOnlyTeams = project.teams.filter((team) => {
    const lookupId = team.remoteTeamId || team.id;
    return !mergedRemoteIds.has(lookupId);
  });

  return [...mergedRemoteTeams, ...localOnlyTeams];
}

function mergeRemoteAthletes(project: PlannerProject, remoteAthletes: AthleteRecord[]) {
  const remoteIds = new Set(remoteAthletes.map((athlete) => athlete.id));
  const remoteRegistrations = new Set(remoteAthletes.map((athlete) => athlete.registrationNumber));
  const localOnlyAthletes = project.athletes.filter((athlete) => (
    !remoteIds.has(athlete.id) && !remoteRegistrations.has(athlete.registrationNumber)
  ));

  return [...remoteAthletes, ...localOnlyAthletes];
}

export function mergeRemoteFoundationIntoProject(
  project: PlannerProject,
  snapshot: PlannerRemoteFoundationSnapshot
): PlannerProject {
  return {
    ...project,
    athletes: mergeRemoteAthletes(project, snapshot.athletes),
    teams: mergeRemoteTeams(project, snapshot.teams)
  };
}

async function listAccessibleTeamRows(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">
) {
  const admin = createAdminClient();
  const teamMap = new Map<string, TeamRow>();

  if (session.role === "admin") {
    const { data } = await admin
      .from("teams" as never)
      .select("*" as never)
      .order("created_at", { ascending: false });

    ((data ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
    return [...teamMap.values()];
  }

  if (session.primaryGymId) {
    const { data } = await admin
      .from("teams" as never)
      .select("*" as never)
      .eq("gym_id", session.primaryGymId as never)
      .order("created_at", { ascending: false });

    ((data ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
  }

  const { data: ownedTeams } = await admin
    .from("teams" as never)
    .select("*" as never)
    .eq("primary_coach_profile_id", session.userId as never)
    .order("created_at", { ascending: false });

  ((ownedTeams ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));

  const { data: linkedRows } = await admin
    .from("team_coaches" as never)
    .select("team_id" as never)
    .eq("coach_profile_id", session.userId as never);

  const linkedTeamIds = Array.from(new Set(((linkedRows ?? []) as Array<Pick<TeamCoachRow, "team_id">>).map((row) => row.team_id)));

  if (linkedTeamIds.length) {
    const { data: linkedTeams } = await admin
      .from("teams" as never)
      .select("*" as never)
      .in("id", linkedTeamIds as never);

    ((linkedTeams ?? []) as TeamRow[]).forEach((team) => teamMap.set(team.id, team));
  }

  return [...teamMap.values()];
}

async function listCoachDisplayNames(teamCoachRows: TeamCoachRow[]) {
  const coachIds = Array.from(new Set(teamCoachRows.map((row) => row.coach_profile_id)));

  if (!coachIds.length) {
    return new Map<string, string>();
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles" as never)
    .select("id, display_name, email" as never)
    .in("id", coachIds as never);

  return new Map(
    ((data ?? []) as Array<Pick<ProfileRow, "id" | "display_name" | "email">>).map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.email?.trim() || "Coach"
    ] as const)
  );
}

export async function listRemotePlannerFoundation(
  session: Pick<AuthSession, "role" | "userId" | "primaryGymId">
): Promise<PlannerRemoteFoundationSnapshot> {
  const admin = createAdminClient();
  const teamRows = await listAccessibleTeamRows(session);
  const teamIds = teamRows.map((team) => team.id);

  const { data: teamCoachData } = teamIds.length
    ? await admin.from("team_coaches" as never).select("*" as never).in("team_id", teamIds as never)
    : { data: [] as unknown[] };
  const teamCoachRows = (teamCoachData ?? []) as TeamCoachRow[];

  const { data: assignmentData } = teamIds.length
    ? await admin.from("athlete_team_assignments" as never).select("*" as never).in("team_id", teamIds as never)
    : { data: [] as unknown[] };
  const assignmentRows = (assignmentData ?? []) as AthleteAssignmentRow[];

  const assignedAthleteIds = Array.from(new Set(assignmentRows.map((assignment) => assignment.athlete_id)));
  const athleteIdSet = new Set<string>(assignedAthleteIds);

  if (session.role === "admin") {
    const { data } = await admin.from("athletes" as never).select("*" as never).order("created_at", { ascending: false });
    ((data ?? []) as AthleteRow[]).forEach((athlete) => athleteIdSet.add(athlete.id));
  } else if (session.primaryGymId) {
    const { data } = await admin.from("athletes" as never).select("*" as never).eq("gym_id", session.primaryGymId as never);
    ((data ?? []) as AthleteRow[]).forEach((athlete) => athleteIdSet.add(athlete.id));
  }

  const { data: ownedAthleteData } = await admin.from("athletes" as never).select("*" as never);
  ((ownedAthleteData ?? []) as AthleteRow[]).forEach((athlete) => {
    const metadata = asObject(athlete.metadata) as AthleteMetadata;
    if (asString(metadata.createdByProfileId) === session.userId) {
      athleteIdSet.add(athlete.id);
    }
  });

  const athleteIds = [...athleteIdSet];
  const athleteRows = athleteIds.length
    ? (((await admin.from("athletes" as never).select("*" as never).in("id", athleteIds as never)).data ?? []) as AthleteRow[])
    : [];

  const athleteMap = new Map(athleteRows.map((row) => {
    const athlete = buildAthleteRecord(row);
    return [athlete.id, athlete] as const;
  }));
  const coachDisplayNameMap = await listCoachDisplayNames(teamCoachRows);

  const teams = teamRows.map((row) => {
    const team = buildTeamRecord(row, teamCoachRows, assignmentRows, athleteMap);
    const metadata = asObject(row.metadata) as TeamMetadata;
    const assignedCoachNames = team.linkedCoachIds?.length
      ? team.linkedCoachIds.map((coachId) => coachDisplayNameMap.get(coachId) ?? "").filter(Boolean)
      : asStringArray(metadata.assignedCoachNames);

    return {
      ...team,
      assignedCoachNames
    };
  });

  return {
    athletes: [...athleteMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
    teams
  };
}
