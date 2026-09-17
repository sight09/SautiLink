import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SECRET = process.env.SAUTILINK_SECRET ?? "sautilink-dev-secret-change-in-production";
const SESSION_COOKIE = "sl_session";

/* ---------------------------------- hashing --------------------------------- */

export function hashSecret(value: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value.normalize("NFKC"), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(value: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(value.normalize("NFKC"), salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/* --------------------------------- sessions --------------------------------- */

export type SessionUser = {
  id: number;
  name: string;
  role: "citizen" | "institution" | "admin";
  institutionId: number | null;
  email: string;
};

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const body = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + 1000 * 60 * 60 * 12 }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionUser & {
      exp: number;
    };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    const { exp: _exp, ...user } = parsed;
    void _exp;
    return user;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(user: SessionUser): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function requireRole(
  roles: Array<SessionUser["role"]>,
): Promise<{ user: SessionUser } | { error: Response }> {
  const user = await getSession();
  if (!user) {
    return {
      error: Response.json(
        { error: "You need to sign in to access this area." },
        { status: 401 },
      ),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      error: Response.json(
        { error: "You don't have permission to access this resource." },
        { status: 403 },
      ),
    };
  }
  return { user };
}

/* ------------------------------- rate limiting ------------------------------ */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local";
  return `${scope}:${ip}`;
}

/* ------------------------------ case identifiers ---------------------------- */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function randomChars(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function generatePublicCaseId(): string {
  return `CS-${randomChars(5)}-${randomChars(3)}`;
}

export function generateAccessCode(): string {
  return randomChars(6);
}
