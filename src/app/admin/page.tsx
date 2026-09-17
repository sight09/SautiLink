import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, cases, categories, institutions, smsInbox, trustedSources, users } from "@/db/schema";
import { BarRow, Stat } from "@/components/ui";
import { formatDateTime, relativeTime } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  const [caseCount, userCount, institutionCount, sourceCount, byChannel, byCategory, categoryRows, recentAudit, sms] =
    await Promise.all([
      db.select({ count: sql<number>`count(*)::int`, anon: sql<number>`count(*) filter (where anonymous)::int` }).from(cases),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(institutions),
      db.select({ count: sql<number>`count(*)::int` }).from(trustedSources),
      db.select({ key: cases.channel, count: sql<number>`count(*)::int` }).from(cases).groupBy(cases.channel),
      db.select({ key: cases.categorySlug, count: sql<number>`count(*)::int` }).from(cases).groupBy(cases.categorySlug),
      db.select().from(categories),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6),
      db.select({ count: sql<number>`count(*)::int` }).from(smsInbox),
    ]);

  const nameFor = (slug: string) => categoryRows.find((c) => c.slug === slug)?.nameEn ?? slug;
  const total = caseCount[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Platform overview</h1>
        <p className="mt-1 text-sm text-ink-500">
          System health and configuration. Every administrative action is written to the audit log.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Cases" value={total} />
        <Stat
          label="Anonymous"
          value={`${total ? Math.round(((caseCount[0]?.anon ?? 0) / total) * 100) : 0}%`}
          hint={`${caseCount[0]?.anon ?? 0} cases`}
        />
        <Stat label="Institutions" value={institutionCount[0]?.count ?? 0} />
        <Stat label="Staff accounts" value={userCount[0]?.count ?? 0} />
        <Stat label="Trusted sources" value={sourceCount[0]?.count ?? 0} tone="ok" />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">Cases by category</h2>
          <div className="mt-2">
            {byCategory.map((row) => (
              <BarRow
                key={row.key}
                label={nameFor(row.key)}
                value={row.count}
                max={Math.max(...byCategory.map((r) => r.count), 1)}
              />
            ))}
          </div>
        </section>

        <section className="sl-card p-4">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">Intake channels</h2>
          <div className="mt-2">
            {byChannel.map((row) => (
              <BarRow
                key={row.key}
                label={row.key === "sms-prototype" ? "SMS fallback (prototype)" : row.key}
                value={row.count}
                max={Math.max(...byChannel.map((r) => r.count), 1)}
                tone="bg-accent-500"
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {sms[0]?.count ?? 0} simulated SMS message(s) processed by the prototype gateway endpoint.
          </p>
        </section>
      </div>

      <section className="sl-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-brand-900">Recent audit activity</h2>
          <Link href="/admin/moderation" className="text-sm font-semibold text-brand-700 underline">
            View all
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-sand-200 text-sm">
          {recentAudit.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-ink-900">
                <span className="font-medium">{entry.actorLabel}</span> · {entry.action}{" "}
                {entry.target && <span className="font-mono text-xs text-ink-500">{entry.target}</span>}
              </span>
              <span className="text-xs text-ink-500" title={formatDateTime(entry.createdAt)}>
                {relativeTime(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
