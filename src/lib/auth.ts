import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { appSessions } from "@/db/schema";

export const SESSION_COOKIE = "moodua_session";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PASSWORD_KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export type AppUser = "admin" | "moodua";

type PasswordVerifier = {
  salt: string;
  hash: string;
};

// These are scrypt verifiers, not passwords. Keep the corresponding plaintext
// passwords in the team's password manager, never in source control.
const PASSWORDS: Record<AppUser, PasswordVerifier> = {
  admin: {
    salt: "wTMZcGAhh0ShYbH3qNLNyA",
    hash: "trmLAY-vlZG2Q5c892fDyZBAC0BTT2B2Cc95f9gKz4dHrV2Y1cahyImSrre74aSpc8amj5fD-3RP1GDrR6Ay_g",
  },
  moodua: {
    salt: "lwin5pdQop1n-qkZ0_TMIA",
    hash: "ZJCw1EoFfVjtmOVMGv7bydNZqJ3EsQnAdN1gJyHX5Yb4sp9J6S2F2vyCxis419M9c2RVgj6XTCuxutib1-ztLQ",
  },
};

function isAppUser(value: unknown): value is AppUser {
  return value === "admin" || value === "moodua";
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function passwordHash(password: string, salt: string): string {
  return scryptSync(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS).toString("base64url");
}

/** Checks a supplied password without exposing which part of the credentials was invalid. */
export function authenticate(username: unknown, password: unknown): AppUser | null {
  const name = typeof username === "string" ? username.trim().toLowerCase() : "";
  const candidate = typeof password === "string" ? password : "";

  // Use a real verifier for unknown users too, so the response timing does not
  // reveal whether an account exists.
  const verifier = PASSWORDS[isAppUser(name) ? name : "admin"];
  const validPassword = candidate.length > 0 && candidate.length <= 512 && equal(
    passwordHash(candidate, verifier.salt),
    verifier.hash,
  );

  return isAppUser(name) && validPassword ? name : null;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
}

export async function createSession(user: AppUser): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const db = getDb();
  await db.delete(appSessions).where(lt(appSessions.expiresAt, new Date()));
  await db.insert(appSessions).values({ tokenHash: tokenHash(token), user, expiresAt: sessionExpiry() });
  return token;
}

async function verifySession(token: string | undefined): Promise<AppUser | null> {
  if (!token) return null;
  const db = getDb();
  const [session] = await db
    .select({ user: appSessions.user, expiresAt: appSessions.expiresAt })
    .from(appSessions)
    .where(eq(appSessions.tokenHash, tokenHash(token)))
    .limit(1);
  if (!session || session.expiresAt <= new Date() || !isAppUser(session.user)) return null;
  return session.user;
}

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

export async function userFromRequest(request: Request): Promise<AppUser | null> {
  try {
    return await verifySession(cookieValue(request.headers.get("cookie"), SESSION_COOKIE));
  } catch (error) {
    console.error("Unable to verify auth session", error);
    return null;
  }
}

export async function currentUser(): Promise<AppUser | null> {
  const store = await cookies();
  try {
    return await verifySession(store.get(SESSION_COOKIE)?.value);
  } catch (error) {
    console.error("Unable to verify auth session", error);
    return null;
  }
}

export async function requireUser(): Promise<AppUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export const sessionCookie = {
  httpOnly: true,
  maxAge: SESSION_TTL_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function removeSession(request: Request): Promise<void> {
  const token = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return;
  try {
    await getDb().delete(appSessions).where(eq(appSessions.tokenHash, tokenHash(token)));
  } catch (error) {
    // The cookie still gets cleared below; failing closed is safer than keeping
    // an unusable browser session because a transient database error occurred.
    console.error("Unable to remove auth session", error);
  }
}
