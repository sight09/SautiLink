import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cases, communitySignals } from "@/db/schema";
import { formatDate } from "@/lib/i18n";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community signals" };

export default async function SignalsPage() {
  const session = await getSession();
  const signals = await db
    .select()
    .from(communitySignals)
    .orderBy(desc(communitySignals.reportCount))
    .limit(12);

  const live = await db
    .select({
      categorySlug: cases.categorySlug,
      areaName: cases.areaName,
      count: sql<number>`count(*)::int`,
    })
    .from(cases)
    .where(
      session?.role === "institution" && session.institutionId
        ? eq(cases.institutionId, session.institutionId)
        : undefined,
    )
    .groupBy(cases.categorySlug, cases.areaName);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Community signals</h1>
        <p className="mt-1 text-sm text-ink-500">
          Aggregated patterns from independent reports. Signals describe the service problem, never an
          accusation against a person or group.
        </p>
      </header>

      <ul className="grid gap-3 lg:grid-cols-2">
        {signals.map((signal) => {
          const liveCount =
            live.find(
              (row) => row.categorySlug === signal.categorySlug && row.areaName === signal.areaName,
            )?.count ?? 0;
          return (
            <li key={signal.id} className="sl-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-brand-900">{signal.titleEn}</h2>
                <span className="shrink-0 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-700">
                  {signal.reportCount} reports
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-500">{signal.areaName}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-ink-500">First reported</dt>
                  <dd className="text-ink-900">{formatDate(signal.firstReportedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Recent activity</dt>
                  <dd className={signal.trendPercent >= 0 ? "text-accent-600" : "text-[#14653f]"}>
                    {signal.trendPercent >= 0 ? "+" : ""}
                    {signal.trendPercent}%
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">Status</dt>
                  <dd className="capitalize text-ink-900">{signal.status.replace(/_/g, " ")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500">In your queue</dt>
                  <dd className="text-ink-900">{liveCount} case(s)</dd>
                </div>
              </dl>
              <Link
                href={`/institution/cases?category=${signal.categorySlug}`}
                className="mt-3 inline-block rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-800"
              >
                View related cases
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
