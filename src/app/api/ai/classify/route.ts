import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cases, categories, institutions } from "@/db/schema";
import { classify, findRelated, matchInstitutions } from "@/lib/civic-ai";
import { clientKey, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  description: z.string().min(1).max(4000),
  categorySlug: z.string().max(40).optional(),
  areaName: z.string().max(120).optional().default(""),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "ai-classify"), 30, 60_000)) {
    return Response.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid input." }, { status: 400 });

  try {
    const categoryRows = await db.select().from(categories).where(eq(categories.active, true));
    const result = classify({
      text: parsed.data.description,
      selectedCategory: parsed.data.categorySlug ?? null,
      categories: categoryRows.map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        keywords: c.keywords ?? [],
        sensitive: c.sensitive,
      })),
    });

    const institutionRows = await db
      .select()
      .from(institutions)
      .where(eq(institutions.status, "active"));
    const matches = matchInstitutions(
      parsed.data.categorySlug ?? result.categorySlug,
      parsed.data.areaName ?? "",
      institutionRows.map((i) => ({
        id: i.id,
        name: i.name,
        shortName: i.shortName,
        categories: i.categories ?? [],
        areas: i.areas ?? [],
        region: i.region,
        type: i.type,
      })),
    );

    let relatedCount = 0;
    if (parsed.data.areaName) {
      const rows = await db
        .select({
          publicCaseId: cases.publicCaseId,
          categorySlug: cases.categorySlug,
          areaName: cases.areaName,
          title: cases.title,
          createdAt: cases.createdAt,
        })
        .from(cases)
        .where(eq(cases.categorySlug, parsed.data.categorySlug ?? result.categorySlug))
        .orderBy(desc(cases.createdAt))
        .limit(500);
      relatedCount = rows.filter(
        (r) => r.areaName.toLowerCase() === parsed.data.areaName!.toLowerCase(),
      ).length;
    }

    const categoryName =
      categoryRows.find((c) => c.slug === result.categorySlug)?.nameEn ?? result.categorySlug;

    return Response.json({
      categorySlug: result.categorySlug,
      categoryName,
      confidence: result.confidence,
      priority: result.priority,
      priorityReason: result.priorityReason,
      summary: result.summary,
      matchedTerms: result.matchedTerms,
      deEscalation: result.deEscalation,
      sensitive: result.sensitive,
      matches,
      relatedCount,
    });
  } catch (error) {
    console.error("ai.classify.failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Civic AI is temporarily unavailable. You can continue manually." },
      { status: 503 },
    );
  }
}
