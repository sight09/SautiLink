import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  caseMessages,
  caseNotes,
  caseStatusHistory,
  cases,
  categories,
  communitySignals,
  evidence,
  institutions,
  notifications,
} from "@/db/schema";
import {
  classify,
  findRelated,
  matchInstitutions,
  type InstitutionMatch,
} from "@/lib/civic-ai";
import { generateAccessCode, generatePublicCaseId, hashSecret, verifySecret } from "@/lib/security";

export type CreateCaseInput = {
  categorySlug: string;
  description: string;
  areaName: string;
  locationNote?: string;
  anonymous: boolean;
  reporterContact?: string;
  language?: string;
  channel?: string;
  reporterUserId?: number | null;
  evidence?: Array<{ type: string; label: string; storageRef?: string; sizeBytes?: number }>;
};

export async function createCase(input: CreateCaseInput) {
  const categoryRows = await db.select().from(categories).where(eq(categories.active, true));
  const ai = classify({
    text: input.description,
    selectedCategory: input.categorySlug,
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
  const matches: InstitutionMatch[] = matchInstitutions(
    input.categorySlug,
    input.areaName,
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
  const bestMatch = matches[0];

  const relatedRows = await db
    .select({
      publicCaseId: cases.publicCaseId,
      categorySlug: cases.categorySlug,
      areaName: cases.areaName,
      title: cases.title,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .where(eq(cases.categorySlug, input.categorySlug))
    .orderBy(desc(cases.createdAt))
    .limit(200);
  const related = findRelated(input.categorySlug, input.areaName, relatedRows);

  const publicCaseId = generatePublicCaseId();
  const accessCode = generateAccessCode();
  const evidenceItems = input.evidence ?? [];

  const trustLevel =
    evidenceItems.length > 0
      ? related.length >= 3
        ? "community_corroborated"
        : "evidence_submitted"
      : related.length >= 3
        ? "community_corroborated"
        : "community_reported";

  const aiNotes = [
    `Category suggested from ${ai.matchedTerms.length ? `terms: ${ai.matchedTerms.join(", ")}` : "the selected category"}.`,
    `Urgency: ${ai.priorityReason}`,
    bestMatch
      ? `Institution match ${bestMatch.score}% — ${bestMatch.reasons.join("; ") || "category/area alignment"}.`
      : "No configured institution matched; routed for manual triage.",
    related.length
      ? `${related.length} report(s) may describe a similar issue in ${input.areaName}.`
      : "No similar recent reports found in this area.",
  ];
  if (ai.deEscalation) aiNotes.push(ai.deEscalation);

  const [created] = await db
    .insert(cases)
    .values({
      publicCaseId,
      accessCodeHash: hashSecret(accessCode),
      categorySlug: input.categorySlug,
      title: ai.title,
      description: input.description,
      summary: ai.summary,
      language: input.language ?? "en",
      priority: ai.priority,
      aiPriority: ai.priority,
      aiCategorySlug: ai.categorySlug,
      aiConfidence: ai.confidence,
      aiInstitutionScore: bestMatch?.score ?? 0,
      aiNotes,
      status: "submitted",
      trustLevel,
      anonymous: input.anonymous,
      reporterUserId: input.anonymous ? null : (input.reporterUserId ?? null),
      reporterContact: input.anonymous ? null : (input.reporterContact ?? null),
      areaName: input.areaName,
      locationNote: input.locationNote ?? "",
      institutionId: bestMatch?.institutionId ?? null,
      channel: input.channel ?? "web",
    })
    .returning();

  if (evidenceItems.length) {
    await db.insert(evidence).values(
      evidenceItems.slice(0, 5).map((item) => ({
        caseId: created.id,
        type: item.type,
        label: item.label.slice(0, 120),
        storageRef: (item.storageRef ?? "").slice(0, 400_000),
        sizeBytes: item.sizeBytes ?? 0,
      })),
    );
  }

  const history = [
    {
      caseId: created.id,
      status: "submitted",
      actorType: "reporter",
      actorLabel: input.anonymous ? "Anonymous reporter" : "Reporter",
      note: "Report received by SautiLink.",
    },
    {
      caseId: created.id,
      status: "submitted",
      actorType: "system",
      actorLabel: "SautiLink civic engine",
      note: `AI-assisted classification: ${ai.categorySlug} · urgency ${ai.priority} (${ai.confidence}% confidence).`,
    },
  ];
  if (evidenceItems.length) {
    history.push({
      caseId: created.id,
      status: "submitted",
      actorType: "system",
      actorLabel: "SautiLink",
      note: `${evidenceItems.length} evidence item(s) received.`,
    });
  }
  if (bestMatch) {
    history.push({
      caseId: created.id,
      status: "under_review",
      actorType: "system",
      actorLabel: "SautiLink",
      note: `${bestMatch.name} notified (match ${bestMatch.score}%).`,
    });
  }
  await db.insert(caseStatusHistory).values(history);

  if (bestMatch) {
    await db
      .update(cases)
      .set({ status: "under_review", updatedAt: new Date() })
      .where(eq(cases.id, created.id));
  }

  await db.insert(notifications).values({
    caseId: created.id,
    audience: "reporter",
    type: "case_created",
    message: `Your case ${publicCaseId} has been received${bestMatch ? ` and routed to ${bestMatch.shortName}` : ""}.`,
  });

  await bumpSignal(input.categorySlug, input.areaName);

  return {
    case: created,
    accessCode,
    publicCaseId,
    ai: { ...ai, notes: aiNotes },
    matches,
    relatedCount: related.length,
  };
}

async function bumpSignal(categorySlug: string, areaName: string) {
  const [existing] = await db
    .select()
    .from(communitySignals)
    .where(
      and(eq(communitySignals.categorySlug, categorySlug), eq(communitySignals.areaName, areaName)),
    )
    .limit(1);
  if (existing) {
    const count = existing.reportCount + 1;
    await db
      .update(communitySignals)
      .set({
        reportCount: count,
        updatedAt: new Date(),
        status: count >= 5 ? "community_corroborated" : existing.status,
      })
      .where(eq(communitySignals.id, existing.id));
  } else {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, categorySlug))
      .limit(1);
    await db.insert(communitySignals).values({
      categorySlug,
      areaName,
      titleEn: `${category?.nameEn ?? "Civic"} reports — ${areaName}`,
      titleSw: `Ripoti za ${category?.nameSw ?? "kiraia"} — ${areaName}`,
      reportCount: 1,
      trendPercent: 0,
    });
  }
}

export type FullCase = Awaited<ReturnType<typeof loadCase>>;

export async function loadCase(publicCaseId: string) {
  const [row] = await db
    .select()
    .from(cases)
    .where(eq(cases.publicCaseId, publicCaseId.toUpperCase()))
    .limit(1);
  if (!row) return null;

  const [evidenceRows, messageRows, historyRows, noteRows] = await Promise.all([
    db.select().from(evidence).where(eq(evidence.caseId, row.id)),
    db
      .select()
      .from(caseMessages)
      .where(eq(caseMessages.caseId, row.id))
      .orderBy(caseMessages.createdAt),
    db
      .select()
      .from(caseStatusHistory)
      .where(eq(caseStatusHistory.caseId, row.id))
      .orderBy(caseStatusHistory.createdAt),
    db.select().from(caseNotes).where(eq(caseNotes.caseId, row.id)).orderBy(caseNotes.createdAt),
  ]);

  const institution = row.institutionId
    ? (
        await db.select().from(institutions).where(eq(institutions.id, row.institutionId)).limit(1)
      )[0]
    : null;

  const relatedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(
      and(
        eq(cases.categorySlug, row.categorySlug),
        eq(cases.areaName, row.areaName),
        ne(cases.id, row.id),
      ),
    );

  return {
    case: row,
    evidence: evidenceRows,
    messages: messageRows,
    history: historyRows,
    notes: noteRows,
    institution: institution ?? null,
    relatedCount: relatedCount[0]?.count ?? 0,
  };
}

export async function verifyCaseAccess(publicCaseId: string, accessCode: string) {
  const [row] = await db
    .select()
    .from(cases)
    .where(eq(cases.publicCaseId, publicCaseId.toUpperCase()))
    .limit(1);
  if (!row) return false;
  return verifySecret(accessCode.trim().toUpperCase(), row.accessCodeHash);
}

export async function addMessage(
  caseId: number,
  senderType: "reporter" | "institution" | "system",
  senderLabel: string,
  body: string,
) {
  const [message] = await db
    .insert(caseMessages)
    .values({
      caseId,
      senderType,
      senderLabel,
      body,
      readByReporter: senderType === "reporter",
      readByInstitution: senderType === "institution",
    })
    .returning();

  await db.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId));

  await db.insert(notifications).values({
    caseId,
    audience: senderType === "reporter" ? "institution" : "reporter",
    type: "message",
    message:
      senderType === "reporter"
        ? "The anonymous reporter replied to your request."
        : "An institution sent you a message about your case.",
  });

  return message;
}

export async function changeStatus(
  caseId: number,
  status: string,
  actorLabel: string,
  note: string,
  actorType = "institution",
) {
  const patch: Record<string, unknown> = { status, updatedAt: new Date() };
  if (status === "resolved") patch.resolvedAt = new Date();
  if (status === "responded" || status === "in_progress" || status === "resolved") {
    patch.trustLevel = status === "resolved" ? "verified" : "institution_responded";
  }
  await db.update(cases).set(patch).where(eq(cases.id, caseId));
  await db.insert(caseStatusHistory).values({ caseId, status, actorType, actorLabel, note });
  await db.insert(notifications).values({
    caseId,
    audience: "reporter",
    type: "status",
    message: `Your case status changed to "${status.replace(/_/g, " ")}".`,
  });
}

export async function audit(
  actorLabel: string,
  actorRole: string,
  action: string,
  target: string,
  meta: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({ actorLabel, actorRole, action, target, meta });
}

/** Public, privacy-safe aggregates. Never exposes reporter identity or evidence. */
export async function publicStats() {
  const byCategory = await db
    .select({
      categorySlug: cases.categorySlug,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .groupBy(cases.categorySlug);

  const byStatus = await db
    .select({ status: cases.status, count: sql<number>`count(*)::int` })
    .from(cases)
    .groupBy(cases.status);

  const byArea = await db
    .select({ areaName: cases.areaName, count: sql<number>`count(*)::int` })
    .from(cases)
    .groupBy(cases.areaName);

  const resolved = await db
    .select({
      avgHours: sql<number>`coalesce(avg(extract(epoch from (resolved_at - created_at)) / 3600), 0)::int`,
    })
    .from(cases)
    .where(eq(cases.status, "resolved"));

  const total = byStatus.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    byCategory: byCategory.sort((a, b) => b.count - a.count),
    byStatus,
    byArea: byArea.sort((a, b) => b.count - a.count).slice(0, 6),
    avgResolutionHours: resolved[0]?.avgHours ?? 0,
  };
}
