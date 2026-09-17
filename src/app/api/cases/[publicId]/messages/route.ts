import { z } from "zod";
import { addMessage, audit, loadCase, verifyCaseAccess } from "@/lib/case-service";
import { clientKey, getSession, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  body: z.string().min(2, "Please write a message.").max(2000),
  accessCode: z.string().max(24).optional().default(""),
});

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!rateLimit(clientKey(request, "case-message"), 20, 60_000)) {
    return Response.json({ error: "Too many messages. Please wait a moment." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 },
    );
  }

  const data = await loadCase(publicId);
  if (!data) {
    return Response.json({ error: "We couldn't find that case." }, { status: 404 });
  }

  const session = await getSession();
  const isInstitution =
    session?.role === "institution" && session.institutionId === data.case.institutionId;
  const hasCode = parsed.data.accessCode
    ? await verifyCaseAccess(publicId, parsed.data.accessCode)
    : false;

  if (!isInstitution && !hasCode) {
    return Response.json(
      { error: "You don't have permission to message on this case." },
      { status: 403 },
    );
  }

  const message = await addMessage(
    data.case.id,
    isInstitution ? "institution" : "reporter",
    isInstitution ? `${session?.name ?? "Institution"} · case desk` : "Anonymous reporter",
    parsed.data.body.trim(),
  );

  if (isInstitution) {
    await audit(session?.name ?? "institution", "institution", "case.message.sent", publicId);
  }

  return Response.json({ message }, { status: 201 });
}
