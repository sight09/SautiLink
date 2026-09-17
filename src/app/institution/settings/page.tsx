import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Institution settings" };

export default async function InstitutionSettings() {
  const session = await getSession();
  const institution = session?.institutionId
    ? (await db.select().from(institutions).where(eq(institutions.id, session.institutionId)).limit(1))[0]
    : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          Routing configuration for your desk. Changes to routing are made by a platform administrator
          so that every change is audit-logged.
        </p>
      </header>

      {institution ? (
        <section className="sl-card p-5">
          <dl className="space-y-3 text-sm">
            {[
              ["Institution", institution.name],
              ["Short name", institution.shortName],
              ["Type", institution.type.replace(/-/g, " ")],
              ["Coverage", `${institution.region}, ${institution.country}`],
              ["Categories handled", (institution.categories ?? []).join(", ")],
              ["Areas served", (institution.areas ?? []).join(" · ")],
              ["Target response", `${institution.slaHours} hours`],
              ["Contact", `${institution.contactEmail ?? "—"} · ${institution.contactPhone ?? "—"}`],
              ["Status", institution.status],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap gap-2">
                <dt className="w-44 shrink-0 text-ink-500">{label}</dt>
                <dd className="text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="sl-card p-5 text-sm text-ink-700">
          You are signed in as a platform administrator and can see all institutions&apos; cases.
        </p>
      )}

      <section className="sl-card p-5 text-sm">
        <h2 className="font-semibold text-brand-900">Handling standards</h2>
        <ul className="mt-2 space-y-1.5 text-ink-700">
          <li>• Never request identifying details from an anonymous reporter.</li>
          <li>• Record every decision as a timeline note — reporters see the same timeline you do.</li>
          <li>• Use internal notes for operational detail that should not be published to the reporter.</li>
          <li>• Sensitive protection cases must only be opened by trained staff.</li>
        </ul>
      </section>
    </div>
  );
}
