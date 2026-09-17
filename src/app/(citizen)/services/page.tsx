import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions, trustedSources } from "@/db/schema";
import { formatDate } from "@/lib/i18n";
import { SmsPrototype } from "@/components/sms-prototype";

export const dynamic = "force-dynamic";
export const metadata = { title: "Find a service" };

export default async function ServicesPage() {
  const [institutionRows, sourceRows] = await Promise.all([
    db.select().from(institutions).where(eq(institutions.status, "active")).orderBy(asc(institutions.name)),
    db.select().from(trustedSources).orderBy(asc(trustedSources.name)),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">Find a service</h1>
        <p className="mt-1 text-sm text-ink-500">
          Configured institutions and the official information SautiLink uses when answering
          questions. Directory entries are pilot demonstration data.
        </p>
      </header>

      <section aria-labelledby="institutions-heading">
        <h2 id="institutions-heading" className="mb-3 text-lg font-semibold tracking-tight text-brand-900">
          Institutions
        </h2>
        <ul className="space-y-2">
          {institutionRows.map((institution) => (
            <li key={institution.id} className="sl-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-brand-900">{institution.name}</h3>
                  <p className="text-sm text-ink-500">
                    {institution.type.replace(/-/g, " ")} · {institution.region}, {institution.country}
                  </p>
                </div>
                <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                  Target response {institution.slaHours}h
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-700">
                Handles: {(institution.categories ?? []).join(", ").replace(/-/g, " ") || "general"}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {institution.contactEmail} · {institution.contactPhone}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sources-heading">
        <h2 id="sources-heading" className="mb-3 text-lg font-semibold tracking-tight text-brand-900">
          Trusted information
        </h2>
        <ul className="space-y-2">
          {sourceRows.map((source) => (
            <li key={source.id} className="sl-card p-4">
              <h3 className="font-semibold text-brand-900">{source.name}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-700">{source.summaryEn}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{source.summarySw}</p>
              <p className="mt-2 text-xs text-ink-500">
                Source: {source.organisation} · {source.reference} · last verified{" "}
                {formatDate(source.lastVerifiedAt)} · status {source.status}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <SmsPrototype />
    </div>
  );
}
