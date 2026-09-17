import { desc, inArray, not } from "drizzle-orm";
import { db } from "@/db";
import { categories, communitySignals } from "@/db/schema";
import { publicStats } from "@/lib/case-service";
import { BarRow, Stat } from "@/components/ui";
import { STATUS_LABEL, formatDate, type CaseStatus } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Public accountability" };

/** Sensitive categories are never published in aggregate form. */
const EXCLUDED = ["protection", "cohesion", "safety"];

export default async function TransparencyPage() {
  const [stats, categoryRows, signals] = await Promise.all([
    publicStats(),
    db.select().from(categories),
    db
      .select()
      .from(communitySignals)
      .where(not(inArray(communitySignals.categorySlug, EXCLUDED)))
      .orderBy(desc(communitySignals.reportCount))
      .limit(6),
  ]);

  const nameFor = (slug: string) => categoryRows.find((c) => c.slug === slug)?.nameEn ?? slug;
  const publishable = stats.byCategory.filter((row) => !EXCLUDED.includes(row.categorySlug));
  const maxCategory = Math.max(...publishable.map((row) => row.count), 1);

  const statusOrder: CaseStatus[] = [
    "submitted",
    "under_review",
    "info_needed",
    "responded",
    "in_progress",
    "resolved",
    "closed",
  ];
  const statusCounts = statusOrder.map((status) => ({
    status,
    count: stats.byStatus.find((row) => row.status === status)?.count ?? 0,
  }));
  const maxStatus = Math.max(...statusCounts.map((row) => row.count), 1);
  const resolved = statusCounts.find((row) => row.status === "resolved")?.count ?? 0;
  const responded =
    (statusCounts.find((row) => row.status === "responded")?.count ?? 0) +
    (statusCounts.find((row) => row.status === "in_progress")?.count ?? 0) +
    resolved;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">
          Public accountability dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Aggregated, privacy-safe figures. No reporter identities, exact locations, evidence or
          messages are ever published, and protection, safety and conflict cases are excluded from
          these aggregates entirely.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Reports" value={stats.total} hint="All channels" />
        <Stat label="Responded" value={responded} tone="ok" hint="Institution engaged" />
        <Stat label="Resolved" value={resolved} tone="ok" hint="Closed with outcome" />
        <Stat
          label="Avg. resolution"
          value={`${stats.avgResolutionHours}h`}
          tone={stats.avgResolutionHours > 240 ? "warn" : "default"}
          hint="Submission → resolved"
        />
      </section>

      <section className="sl-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">Community issues</h2>
        <div className="mt-2">
          {publishable.map((row) => (
            <BarRow
              key={row.categorySlug}
              label={nameFor(row.categorySlug)}
              value={row.count}
              max={maxCategory}
            />
          ))}
        </div>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">Outcomes</h2>
        <div className="mt-2">
          {statusCounts.map((row) => (
            <BarRow
              key={row.status}
              label={STATUS_LABEL[row.status].en}
              value={row.count}
              max={maxStatus}
              tone={row.status === "resolved" ? "bg-[#1a7f52]" : "bg-brand-600"}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-brand-900">Community signals</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <li key={signal.id} className="sl-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-brand-900">{signal.titleEn}</h3>
                <span className="shrink-0 rounded-full border border-sand-200 bg-sand-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                  {signal.reportCount} reports
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-sm text-ink-700">
                <div className="flex gap-2">
                  <dt className="w-28 text-ink-500">Area</dt>
                  <dd>{signal.areaName}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 text-ink-500">First reported</dt>
                  <dd>{formatDate(signal.firstReportedAt)}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 text-ink-500">Recent activity</dt>
                  <dd>
                    {signal.trendPercent >= 0 ? "+" : ""}
                    {signal.trendPercent}%
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-28 text-ink-500">Status</dt>
                  <dd className="capitalize">{signal.status.replace(/_/g, " ")}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-ink-500">
                Community reports indicate a recurring issue. This is not a finding against any named
                person or group.
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">Where reports come from</h2>
        <div className="mt-2">
          {stats.byArea.map((row) => (
            <BarRow
              key={row.areaName}
              label={row.areaName}
              value={row.count}
              max={Math.max(...stats.byArea.map((a) => a.count), 1)}
              tone="bg-accent-500"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
