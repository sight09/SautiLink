import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, cases, institutions, trustedSources, users } from "@/db/schema";
import { audit } from "@/lib/case-service";
import { requireRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("category.create"),
    slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and hyphens."),
    nameEn: z.string().min(2).max(80),
    nameSw: z.string().min(2).max(80),
    icon: z.string().max(4).optional().default("📌"),
    keywords: z.string().max(400).optional().default(""),
  }),
  z.object({ action: z.literal("category.toggle"), id: z.number().int() }),
  z.object({ action: z.literal("source.verify"), id: z.number().int() }),
  z.object({ action: z.literal("institution.toggle"), id: z.number().int() }),
  z.object({ action: z.literal("user.toggle"), id: z.number().int() }),
  z.object({
    action: z.literal("case.moderate"),
    publicCaseId: z.string().min(4).max(24),
    decision: z.enum(["keep", "close"]),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid administrative action." },
      { status: 400 },
    );
  }
  const input = parsed.data;

  switch (input.action) {
    case "category.create": {
      const existing = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, input.slug))
        .limit(1);
      if (existing.length) {
        return Response.json({ error: "That category slug already exists." }, { status: 409 });
      }
      await db.insert(categories).values({
        slug: input.slug,
        nameEn: input.nameEn,
        nameSw: input.nameSw,
        icon: input.icon || "📌",
        keywords: input.keywords
          ? input.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
          : [],
        sortOrder: 99,
      });
      break;
    }
    case "category.toggle": {
      const [row] = await db.select().from(categories).where(eq(categories.id, input.id)).limit(1);
      if (!row) return Response.json({ error: "Category not found." }, { status: 404 });
      await db.update(categories).set({ active: !row.active }).where(eq(categories.id, input.id));
      break;
    }
    case "source.verify": {
      await db
        .update(trustedSources)
        .set({ lastVerifiedAt: new Date(), status: "verified" })
        .where(eq(trustedSources.id, input.id));
      break;
    }
    case "institution.toggle": {
      const [row] = await db.select().from(institutions).where(eq(institutions.id, input.id)).limit(1);
      if (!row) return Response.json({ error: "Institution not found." }, { status: 404 });
      await db
        .update(institutions)
        .set({ status: row.status === "active" ? "suspended" : "active" })
        .where(eq(institutions.id, input.id));
      break;
    }
    case "user.toggle": {
      const [row] = await db.select().from(users).where(eq(users.id, input.id)).limit(1);
      if (!row) return Response.json({ error: "User not found." }, { status: 404 });
      if (row.id === user.id) {
        return Response.json({ error: "You cannot suspend your own account." }, { status: 400 });
      }
      await db
        .update(users)
        .set({ status: row.status === "active" ? "suspended" : "active" })
        .where(eq(users.id, input.id));
      break;
    }
    case "case.moderate": {
      if (input.decision === "close") {
        await db
          .update(cases)
          .set({ status: "closed", updatedAt: new Date() })
          .where(eq(cases.publicCaseId, input.publicCaseId.toUpperCase()));
      } else {
        await db
          .update(cases)
          .set({ updatedAt: new Date() })
          .where(eq(cases.publicCaseId, input.publicCaseId.toUpperCase()));
      }
      break;
    }
  }

  await audit(user.name, "admin", input.action, "id" in input ? String(input.id) : "n/a", {
    ...input,
  });

  return Response.json({ ok: true });
}
