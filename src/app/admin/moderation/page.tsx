import Link from "next/link";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, cases } from "@/db/schema";
import { ModerationButtons } from "@/components/admin-actions";
import { EmptyState, PriorityPill, StatusPill } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation & audit" };

export default async function AdminModeration() {
  // Review queue: sensitive categories, critical priority, or cases with no
  // institutional movement after a long period.
  const review = await db
    .select()
    .from(cases)
    .where(
      and(
        or(
          inArray(cases.categorySlug, ["protection", "cohesion", "safety"]),
          eq(cases.priority, "critical"),
          sql`${cases.status} = 'submitted' and ${cases.createdAt} < now() - interval '7 days'`,
        ),
        sql`${cases.status} <> 'closed'`,
      ),
    )
    .orderBy(desc(cases.createdAt))
    .limit(15);

  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(40);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Moderation &amp; audit</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cases needing human review: sensitive categories, critical urgency, or reports with no
          institutional movement. Moderation never edits a reporter&apos;s words.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-brand-900">
          Review queue ({review.length})
        </h2>
        {review.length === 0 ? (
          <EmptyState icon="🛡️" title="Nothing awaiting review" body="Sensitive and stalled cases will appear here automatically." />
        ) : (
          <ul className="space-y-2">
            {review.map((row) => (
              <li key={row.id} className="sl-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link
                      href={`/institution/cases/${row.publicCaseId}`}
                      className="font-semibold text-brand-900 underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="font-mono text-xs text-ink-500">
                      {row.publicCaseId} · {row.categorySlug} · {row.areaName} ·{" "}
                      {relativeTime(row.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <PriorityPill priority={row.priority} />
                    <StatusPill status={row.status} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-700">{row.summary || row.description}</p>
                <div className="mt-3">
                  <ModerationButtons publicCaseId={row.publicCaseId} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sl-card overflow-x-auto">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Audit log
        </h2>
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-2">Actor</th>
              <th scope="col" className="px-4 py-2">Role</th>
              <th scope="col" className="px-4 py-2">Action</th>
              <th scope="col" className="px-4 py-2">Target</th>
              <th scope="col" className="px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {logs.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2.5 font-medium text-ink-900">{entry.actorLabel}</td>
                <td className="px-4 py-2.5 capitalize text-ink-700">{entry.actorRole}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-700">{entry.action}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-500">{entry.target || "—"}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-500">
                  {formatDateTime(entry.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
