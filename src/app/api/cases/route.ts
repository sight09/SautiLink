import { z } from "zod";
import { createCase } from "@/lib/case-service";
import { clientKey, getSession, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const evidenceSchema = z.object({
  type: z.enum(["photo", "document", "audio", "note"]),
  label: z.string().min(1).max(160),
  storageRef: z.string().max(400_000).optional().default(""),
  sizeBytes: z.number().int().min(0).max(5_000_000).optional().default(0),
});

const bodySchema = z.object({
  categorySlug: z.string().min(2).max(40),
  description: z.string().min(15, "Please describe the issue in a little more detail.").max(4000),
  areaName: z.string().min(2).max(120),
  locationNote: z.string().max(240).optional().default(""),
  anonymous: z.boolean(),
  reporterContact: z.string().max(160).optional().default(""),
  language: z.enum(["en", "sw"]).optional().default("en"),
  channel: z.string().max(40).optional().default("web"),
  evidence: z.array(evidenceSchema).max(5).optional().default([]),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "case-create"), 12, 60_000)) {
    return Response.json(
      { error: "Too many reports submitted from this device. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "We couldn't read that request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the report details." },
      { status: 400 },
    );
  }

  const session = await getSession();

  try {
    const result = await createCase({
      ...parsed.data,
      reporterUserId: parsed.data.anonymous ? null : (session?.id ?? null),
    });
    return Response.json(
      {
        publicCaseId: result.publicCaseId,
        accessCode: result.accessCode,
        title: result.case.title,
        status: result.case.status,
        trustLevel: result.case.trustLevel,
        priority: result.case.priority,
        summary: result.case.summary,
        ai: {
          categorySlug: result.ai.categorySlug,
          confidence: result.ai.confidence,
          priority: result.ai.priority,
          priorityReason: result.ai.priorityReason,
          notes: result.ai.notes,
          deEscalation: result.ai.deEscalation,
        },
        institution: result.matches[0]
          ? { name: result.matches[0].name, score: result.matches[0].score }
          : null,
        relatedCount: result.relatedCount,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("case.create.failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "We couldn't submit this report right now. It stays saved on your device." },
      { status: 500 },
    );
  }
}
