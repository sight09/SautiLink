import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/case-service";
import { clientKey, rateLimit, setSession, verifySecret, type SessionUser } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(6, "Enter your password."),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "login"), 8, 60_000)) {
    return Response.json(
      { error: "Too many sign-in attempts. Please wait a minute." },
      { status: 429 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid credentials." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase().trim()))
    .limit(1);

  // Uniform error message: never reveal whether an account exists.
  const invalid = Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  if (!user || user.status !== "active") return invalid;
  if (!verifySecret(parsed.data.password, user.passwordHash)) return invalid;

  const session: SessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as SessionUser["role"],
    institutionId: user.institutionId ?? null,
  };
  await setSession(session);
  await audit(user.name, user.role, "auth.login", user.email);

  return Response.json({
    user: session,
    redirect:
      session.role === "admin"
        ? "/admin"
        : session.role === "institution"
          ? "/institution"
          : "/",
  });
}
