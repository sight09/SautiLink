import Link from "next/link";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cases, institutions } from "@/db/schema";
import { Stat, StatusPill, PriorityPill, TrustBadge, EmptyState } from "@/components/ui";
import { relativeTime } from "@/lib/i18n";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Institution overview" };

export default async function InstitutionOverview() {
  const session = await getSession();
  const scope: SQL | undefined =
    session?.role === "institution" && session.institutionId
      ? eq(cases.institutionId, session.institutionId)
      : undefined;

  const [institution] = session?.institutionId
    ? await db.select().from(institutions).where(eq(institutions.id, session.institutionId)).limit(1)
    : [null];
  const slaHours = institution?.slaHours ?? 72;

  const counts = await db
    .select({ status: cases.status, count: sql<number>`count(*)::int` })
    .from(cases)
    .where(scope)
    .groupBy(cases.status);

  const priorityCounts = await db
    .select({ priority: cases.priority, count: sql<number>`count(*)::int` })
    .from(cases)
    .where(scope)
    .groupBy(cases.priority);

  const overdue = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(cases)
    .where(
      and(
        scope,
        sql`${cases.status} in ('submitted','under_review','info_needed','in_progress')`,
        sql`${cases.createdAt} < now() - (${slaHours} || ' hours')::interval`,
      ),
    );

  const recent = await db
    .select()
    .from(cases)
    .where(scope)
    .orderBy(desc(cases.updatedAt))
    .limit(8);

  const byStatus = (status: string) => counts.find((row) => row.status === status)?.count ?? 0;
  const open = counts
    .filter((row) => !["resolved", "closed"].includes(row.status))
    .reduce((sum, row) => sum + row.count, 0);
  const highPriority = priorityCounts
    .filter((row) => row.priority === "high" || row.priority === "critical")
    .reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Overview</h1>
          <p className="mt-1 text-sm text-ink-500">
            {institution ? institution.name : "All institutions"} · target response {slaHours}h
          </p>
        </div>
        <Link
          href="/institution/cases"
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Open case queue
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Open cases" value={open} hint="Not resolved or closed" />
        <Stat label="High priority" value={highPriority} tone="warn" hint="High + critical" />
        <Stat label="Awaiting response" value={byStatus("submitted") + byStatus("under_review")} hint="No reply sent yet" />
        <Stat label="Overdue" value={overdue[0]?.count ?? 0} tone="danger" hint={`Older than ${slaHours}h`} />
        <Stat label="Resolved" value={byStatus("resolved")} tone="ok" hint="With outcome recorded" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-brand-900">Recently updated</h2>
        {recent.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No cases routed here yet"
            body="When a community report matches this institution's categories and areas, it will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {recent.map((row) => (
              <li key={row.id} className="sl-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/institution/cases/${row.publicCaseId}`}
                      className="font-semibold text-brand-900 underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <p className="font-mono text-xs text-ink-500">
                      {row.publicCaseId} · {row.areaName} · updated {relativeTime(row.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <PriorityPill priority={row.priority} />
                    <StatusPill status={row.status} />
                    <TrustBadge level={row.trustLevel} />
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-700">{row.summary || row.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
