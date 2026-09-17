import { loadCase, verifyCaseAccess } from "@/lib/case-service";
import { clientKey, getSession, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * Case access rules:
 *  - anonymous reporter: must present the case access code
 *  - institution staff: only cases routed to their institution
 *  - admin: metadata only (no evidence payloads, no message bodies)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";

  if (!rateLimit(clientKey(request, "case-read"), 40, 60_000)) {
    return Response.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 });
  }

  const session = await getSession();
  const data = await loadCase(publicId);
  if (!data) {
    return Response.json(
      { error: "We couldn't find that case. Check your Case ID and try again." },
      { status: 404 },
    );
  }

  const isInstitution =
    session?.role === "institution" && session.institutionId === data.case.institutionId;
  const isAdmin = session?.role === "admin";
  const hasCode = code ? await verifyCaseAccess(publicId, code) : false;

  if (!hasCode && !isInstitution && !isAdmin) {
    return Response.json(
      { error: "You don't have permission to access this case. A valid access code is required." },
      { status: 403 },
    );
  }

  const { accessCodeHash: _hash, reporterContact, ...safeCase } = data.case;
  void _hash;

  return Response.json({
    case: {
      ...safeCase,
      // institutions never see reporter contact details for anonymous cases
      reporterContact: hasCode && !data.case.anonymous ? reporterContact : null,
    },
    evidence: data.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      storageRef: isAdmin ? "" : item.storageRef,
    })),
    messages: data.messages,
    history: data.history,
    notes: isInstitution || isAdmin ? data.notes : [],
    institution: data.institution
      ? {
          name: data.institution.name,
          shortName: data.institution.shortName,
          contactEmail: data.institution.contactEmail,
          slaHours: data.institution.slaHours,
        }
      : null,
    relatedCount: data.relatedCount,
    viewer: isInstitution ? "institution" : isAdmin ? "admin" : "reporter",
  });
}
