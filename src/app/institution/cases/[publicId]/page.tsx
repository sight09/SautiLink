import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { loadCase } from "@/lib/case-service";
import { getSession } from "@/lib/security";
import { InstitutionCaseTools } from "@/components/institution-case-tools";
import { PriorityPill, StatusPill, Timeline, TrustBadge } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case detail" };

export default async function InstitutionCaseDetail({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await loadCase(publicId);
  if (!data) notFound();

  if (
    session.role === "institution" &&
    session.institutionId !== data.case.institutionId
  ) {
    return (
      <div className="sl-card max-w-lg p-6">
        <h1 className="text-lg font-semibold text-brand-900">Access denied</h1>
        <p className="mt-2 text-sm text-ink-700">
          You don&apos;t have permission to access this case. It is routed to a different institution.
        </p>
        <Link href="/institution/cases" className="mt-3 inline-block text-sm font-semibold text-brand-700 underline">
          Back to case queue
        </Link>
      </div>
    );
  }

  const related = await db
    .select({
      publicCaseId: cases.publicCaseId,
      title: cases.title,
      status: cases.status,
      createdAt: cases.createdAt,
    })
    .from(cases)
    .where(
      and(
        eq(cases.categorySlug, data.case.categorySlug),
        eq(cases.areaName, data.case.areaName),
        ne(cases.id, data.case.id),
      ),
    )
    .orderBy(desc(cases.createdAt))
    .limit(5);

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <Link href="/institution/cases" className="underline-offset-2 hover:underline">
          Case queue
        </Link>{" "}
        / <span className="font-mono">{data.case.publicCaseId}</span>
      </nav>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <header className="sl-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={data.case.status} />
              <PriorityPill priority={data.case.priority} />
              <TrustBadge level={data.case.trustLevel} />
              {data.case.anonymous && (
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                  🕶️ Anonymous reporter
                </span>
              )}
              {data.case.channel === "sms-prototype" && (
                <span className="rounded-full border border-[#f3ddbe] bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-600">
                  SMS fallback prototype
                </span>
              )}
            </div>
            <h1 className="mt-3 text-xl font-semibold tracking-tight text-brand-900">{data.case.title}</h1>
            <p className="mt-1 text-sm text-ink-500">
              {data.case.areaName} · submitted {relativeTime(data.case.createdAt)} · assigned to{" "}
              {data.case.assignedTo || "unassigned"}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-900">{data.case.description}</p>
            {data.case.locationNote && (
              <p className="mt-2 text-sm text-ink-700">Location detail: {data.case.locationNote}</p>
            )}
            <p className="mt-3 rounded-xl border border-sand-200 bg-sand-100 px-3 py-2 text-xs text-ink-700">
              Reporter identity is not available to institution staff on anonymous cases. Communicate
              through the case thread.
            </p>
          </header>

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">AI-assisted analysis</h2>
            <p className="mt-1 text-xs text-ink-500">
              Suggestion only ({data.case.aiConfidence}% category confidence). Staff judgement decides.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              {(data.case.aiNotes ?? []).map((note, index) => (
                <li key={index}>• {note}</li>
              ))}
            </ul>
          </section>

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">Evidence ({data.evidence.length})</h2>
            {data.evidence.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No evidence attached to this case.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.evidence.map((item) => (
                  <li key={item.id} className="rounded-xl border border-sand-200 p-3">
                    <p className="text-sm font-medium text-ink-900">
                      {item.type === "photo" ? "📷" : "📝"} {item.label}
                    </p>
                    <p className="text-xs text-ink-500">
                      {item.sizeBytes > 0 ? `${Math.round(item.sizeBytes / 1024)} KB · ` : ""}
                      received {formatDateTime(item.createdAt)}
                    </p>
                    {item.type === "photo" && item.storageRef && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.storageRef}
                        alt={`Evidence: ${item.label}`}
                        className="mt-2 max-h-64 rounded-lg border border-sand-200"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">Anonymous conversation</h2>
            <div className="mt-2 space-y-2">
              {data.messages.length === 0 && (
                <p className="text-sm text-ink-500">No messages yet.</p>
              )}
              {data.messages.map((message) => (
                <article
                  key={message.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    message.senderType === "institution"
                      ? "ml-6 border-brand-100 bg-brand-50"
                      : "border-sand-200 bg-white"
                  }`}
                >
                  <p className="text-xs font-semibold text-ink-500">
                    {message.senderLabel} · {formatDateTime(message.createdAt)}
                  </p>
                  <p className="mt-1 text-ink-900">{message.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">Timeline</h2>
            <div className="mt-3">
              <Timeline entries={data.history} />
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <InstitutionCaseTools
            publicCaseId={data.case.publicCaseId}
            status={data.case.status}
            priority={data.case.priority}
            assignedTo={data.case.assignedTo ?? ""}
          />

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">Internal notes</h2>
            {data.notes.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No internal notes yet.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.notes.map((note) => (
                  <li key={note.id} className="rounded-xl bg-sand-100 px-3 py-2">
                    <p className="text-ink-900">{note.body}</p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {note.authorLabel} · {formatDateTime(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sl-card p-4">
            <h2 className="text-sm font-semibold text-brand-900">
              Related community reports ({data.relatedCount})
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {related.map((row) => (
                <li key={row.publicCaseId}>
                  <Link
                    href={`/institution/cases/${row.publicCaseId}`}
                    className="text-brand-800 underline-offset-2 hover:underline"
                  >
                    {row.title}
                  </Link>
                  <span className="block text-xs text-ink-500">
                    {row.publicCaseId} · {relativeTime(row.createdAt)}
                  </span>
                </li>
              ))}
              {related.length === 0 && <li className="text-ink-500">No similar reports in this area.</li>}
            </ul>
            <p className="mt-2 text-xs text-ink-500">
              Related cases are never merged automatically — corroboration is shown, not assumed.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
