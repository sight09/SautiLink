import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cases, categories } from "@/db/schema";
import { BarRow, Stat } from "@/components/ui";
import { STATUS_LABEL, type CaseStatus } from "@/lib/i18n";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await getSession();
  const scope: SQL | undefined =
    session?.role === "institution" && session.institutionId
      ? eq(cases.institutionId, session.institutionId)
      : undefined;

  const [byStatus, byCategory, byPriority, byChannel, timings, categoryRows] = await Promise.all([
    db.select({ key: cases.status, count: sql<number>`count(*)::int` }).from(cases).where(scope).groupBy(cases.status),
    db.select({ key: cases.categorySlug, count: sql<number>`count(*)::int` }).from(cases).where(scope).groupBy(cases.categorySlug),
    db.select({ key: cases.priority, count: sql<number>`count(*)::int` }).from(cases).where(scope).groupBy(cases.priority),
    db.select({ key: cases.channel, count: sql<number>`count(*)::int` }).from(cases).where(scope).groupBy(cases.channel),
    db
      .select({
        avgResolution: sql<number>`coalesce(avg(extract(epoch from (resolved_at - created_at))/3600) filter (where resolved_at is not null), 0)::int`,
        total: sql<number>`count(*)::int`,
        resolved: sql<number>`count(*) filter (where status = 'resolved')::int`,
        anonymous: sql<number>`count(*) filter (where anonymous)::int`,
      })
      .from(cases)
      .where(scope),
    db.select().from(categories),
  ]);

  const summary = timings[0] ?? { avgResolution: 0, total: 0, resolved: 0, anonymous: 0 };
  const nameFor = (slug: string) => categoryRows.find((c) => c.slug === slug)?.nameEn ?? slug;
  const max = (rows: Array<{ count: number }>) => Math.max(...rows.map((r) => r.count), 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">
          Operational performance for cases routed to your institution.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total cases" value={summary.total} />
        <Stat label="Resolved" value={summary.resolved} tone="ok" />
        <Stat
          label="Resolution rate"
          value={`${summary.total ? Math.round((summary.resolved / summary.total) * 100) : 0}%`}
        />
        <Stat label="Avg. resolution" value={`${summary.avgResolution}h`} hint="Submission → resolved" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">By status</h2>
          <div className="mt-2">
            {byStatus.map((row) => (
              <BarRow
                key={row.key}
                label={STATUS_LABEL[row.key as CaseStatus]?.en ?? row.key}
                value={row.count}
                max={max(byStatus)}
              />
            ))}
          </div>
        </section>

        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">By category</h2>
          <div className="mt-2">
            {byCategory.map((row) => (
              <BarRow key={row.key} label={nameFor(row.key)} value={row.count} max={max(byCategory)} />
            ))}
          </div>
        </section>

        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">By priority</h2>
          <div className="mt-2">
            {byPriority.map((row) => (
              <BarRow
                key={row.key}
                label={row.key}
                value={row.count}
                max={max(byPriority)}
                tone={row.key === "critical" ? "bg-[#b3261e]" : "bg-accent-500"}
              />
            ))}
          </div>
        </section>

        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">Reporting channel</h2>
          <div className="mt-2">
            {byChannel.map((row) => (
              <BarRow
                key={row.key}
                label={row.key === "sms-prototype" ? "SMS fallback (prototype)" : row.key}
                value={row.count}
                max={max(byChannel)}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {summary.anonymous} of {summary.total} cases were submitted anonymously — a key indicator
            that the protection model is being used.
          </p>
        </section>
      </div>
    </div>
  );
}
