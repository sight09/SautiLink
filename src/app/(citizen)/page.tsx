import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { communitySignals } from "@/db/schema";
import { HomeActions, DeviceCases } from "@/components/citizen-home";

export const dynamic = "force-dynamic";

export default async function CitizenHome() {
  const signals = await db
    .select()
    .from(communitySignals)
    .orderBy(desc(communitySignals.reportCount))
    .limit(2);

  return (
    <div className="space-y-7">
      <HomeActions />

      <section aria-labelledby="signals-heading">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 id="signals-heading" className="text-lg font-semibold tracking-tight text-brand-900">
              Community signals near you
            </h2>
            <p className="text-sm text-ink-500">
              Independent reports describing a similar issue. Aggregated, never personal.
            </p>
          </div>
          <Link href="/transparency" className="text-sm font-semibold text-brand-700 underline-offset-2 hover:underline">
            See all
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <li key={signal.id} className="sl-card p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-brand-900">{signal.titleEn}</h3>
                <span className="shrink-0 rounded-full border border-sand-200 bg-sand-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                  {signal.reportCount} reports
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-500">{signal.areaName}</p>
              <p className="mt-2 text-xs text-ink-500">
                Trend {signal.trendPercent >= 0 ? "+" : ""}
                {signal.trendPercent}% · Status: {signal.status.replace(/_/g, " ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <DeviceCases />

      <section className="sl-card overflow-hidden">
        <div className="border-b border-sand-200 bg-brand-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-brand-900">How SautiLink protects you</h2>
        </div>
        <ul className="divide-y divide-sand-200 text-sm">
          {[
            ["01", "Anonymous by default", "Institutions see “Anonymous reporter” — never your name, phone or email."],
            ["02", "Works offline", "Write a report with no signal. It stays on your device until a connection returns."],
            ["03", "Reported ≠ verified", "Every case shows whether it is community reported, corroborated, or institution-answered."],
            ["04", "Reply without exposure", "Answer an institution's questions using only your Case ID and access code."],
          ].map(([icon, title, body]) => (
            <li key={title} className="flex gap-3 px-4 py-3">
              <span aria-hidden className="w-8 shrink-0 font-mono text-xs font-semibold text-brand-700">
                {icon}
              </span>
              <div>
                <p className="font-medium text-ink-900">{title}</p>
                <p className="text-ink-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-sand-200 bg-white px-4 py-4 text-sm text-ink-500">
        <p>
          Staff area:{" "}
          <Link href="/login" className="font-semibold text-brand-700 underline-offset-2 hover:underline">
            institution &amp; administrator sign-in
          </Link>
          . Demonstration dataset — all people, contacts and cases are fictional.
        </p>
      </section>
    </div>
  );
}
