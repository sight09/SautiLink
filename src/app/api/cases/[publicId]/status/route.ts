import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { caseNotes, cases } from "@/db/schema";
import { addMessage, audit, changeStatus, loadCase } from "@/lib/case-service";
import { CASE_STATUSES } from "@/lib/i18n";
import { requireRole } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  note: z.string().max(1200).optional().default(""),
  internalNote: z.string().max(1200).optional(),
  assignedTo: z.string().max(120).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  messageToReporter: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const auth = await requireRole(["institution", "admin"]);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid update." }, { status: 400 });
  }

  const data = await loadCase(publicId);
  if (!data) return Response.json({ error: "We couldn't find that case." }, { status: 404 });

  if (user.role === "institution" && user.institutionId !== data.case.institutionId) {
    return Response.json(
      { error: "You don't have permission to update this case." },
      { status: 403 },
    );
  }

  const actorLabel = `${user.name} · case desk`;

  if (parsed.data.assignedTo !== undefined || parsed.data.priority !== undefined) {
    await db
      .update(cases)
      .set({
        ...(parsed.data.assignedTo !== undefined ? { assignedTo: parsed.data.assignedTo } : {}),
        ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
        updatedAt: new Date(),
      })
      .where(eq(cases.id, data.case.id));
  }

  if (parsed.data.internalNote) {
    await db.insert(caseNotes).values({
      caseId: data.case.id,
      authorLabel: user.name,
      body: parsed.data.internalNote,
    });
  }

  if (parsed.data.messageToReporter) {
    await addMessage(data.case.id, "institution", actorLabel, parsed.data.messageToReporter);
  }

  if (parsed.data.status) {
    await changeStatus(
      data.case.id,
      parsed.data.status,
      actorLabel,
      parsed.data.note || "Status updated by the handling institution.",
    );
  }

  await audit(user.name, user.role, "case.updated", publicId, {
    status: parsed.data.status ?? null,
    assignedTo: parsed.data.assignedTo ?? null,
  });

  return Response.json({ ok: true });
}
