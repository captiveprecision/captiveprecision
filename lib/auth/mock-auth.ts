import { cookies } from "next/headers";

export type AppRole = "admin" | "coach" | "gym";

type MockUserRecord = {
  email: string;
  password: string;
  displayName: string;
  roles: AppRole[];
};

export type AuthSession = {
  email: string;
  displayName: string;
  roles: AppRole[];
};

export const SESSION_COOKIE_NAME = "cp_mock_session";
export const USERS_COOKIE_NAME = "cp_mock_users";

export const seededUsers: MockUserRecord[] = [
  {
    email: "james@captiveprecision.com",
    password: "Captive123!",
    displayName: "James Lee",
    roles: ["coach", "gym", "admin"]
  }
];

function encodeValue<T>(value: T) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeValue<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function readStoredUsers(rawCookie: string | undefined) {
  const storedUsers = decodeValue<MockUserRecord[]>(rawCookie);
  return Array.isArray(storedUsers) ? storedUsers : [];
}

export function readSession(rawCookie: string | undefined) {
  return decodeValue<AuthSession>(rawCookie);
}

export function buildUsersCookie(users: MockUserRecord[]) {
  return encodeValue(users);
}

export function buildSessionCookie(session: AuthSession) {
  return encodeValue(session);
}

export async function getAuthSession() {
  const cookieStore = await cookies();
  return readSession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export async function getMergedUsers() {
  const cookieStore = await cookies();
  const storedUsers = readStoredUsers(cookieStore.get(USERS_COOKIE_NAME)?.value);
  return [...seededUsers, ...storedUsers];
}

export function findUserByCredentials(users: MockUserRecord[], email: string, password: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase() && user.password === password) ?? null;
}

export function findUserByEmail(users: MockUserRecord[], email: string) {
  return users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}
