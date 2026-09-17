import { asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, trustedSources } from "@/db/schema";
import { AdminToggle, CategoryCreateForm } from "@/components/admin-actions";
import { LANGUAGES, formatDate } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Categories & sources" };

export default async function AdminConfig() {
  const [categoryRows, sourceRows] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(trustedSources).orderBy(asc(trustedSources.name)),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Categories &amp; sources</h1>
        <p className="mt-1 text-sm text-ink-500">
          Issue categories drive the reporting flow, AI classification and routing. Trusted sources are
          the only material the civic assistant may quote.
        </p>
      </header>

      <section className="sl-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">Add a category</h2>
        <p className="mb-3 mt-1 text-sm text-ink-500">
          New categories appear immediately in the citizen reporting flow.
        </p>
        <CategoryCreateForm />
      </section>

      <section className="sl-card overflow-x-auto">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Issue categories ({categoryRows.length})
        </h2>
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-2">Category</th>
              <th scope="col" className="px-4 py-2">Swahili</th>
              <th scope="col" className="px-4 py-2">Keywords</th>
              <th scope="col" className="px-4 py-2">Sensitive</th>
              <th scope="col" className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {categoryRows.map((row) => (
              <tr key={row.id} className={row.active ? "" : "opacity-60"}>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink-900">
                    {row.icon} {row.nameEn}
                  </span>
                  <span className="block font-mono text-xs text-ink-500">{row.slug}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-700">{row.nameSw}</td>
                <td className="px-4 py-2.5 text-xs text-ink-500">
                  {(row.keywords ?? []).slice(0, 6).join(", ") || "—"}
                </td>
                <td className="px-4 py-2.5 text-ink-700">{row.sensitive ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 text-right">
                  <AdminToggle
                    action="category.toggle"
                    id={row.id}
                    label={row.active ? "Disable" : "Enable"}
                    danger={row.active}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sl-card overflow-hidden">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Trusted sources ({sourceRows.length})
        </h2>
        <ul className="divide-y divide-sand-200">
          {sourceRows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-ink-900">{row.name}</p>
                <p className="text-sm text-ink-500">
                  {row.organisation} · {row.reference}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Last verified {formatDate(row.lastVerifiedAt)} · status {row.status} · keywords:{" "}
                  {(row.keywords ?? []).join(", ")}
                </p>
              </div>
              <AdminToggle action="source.verify" id={row.id} label="Mark verified today" />
            </li>
          ))}
        </ul>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">Localisation</h2>
        <p className="mt-1 text-sm text-ink-500">
          Interface languages available to citizens. Adding a language means adding one dictionary
          object plus translated category and source fields.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {LANGUAGES.map((language) => (
            <li
              key={language.code}
              className="rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-800"
            >
              {language.native} ({language.code}) · live
            </li>
          ))}
          {["Amharic", "Afaan Oromo", "Hausa", "Yoruba", "isiZulu", "French", "Arabic", "Portuguese"].map(
            (language) => (
              <li
                key={language}
                className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-sm text-ink-500"
              >
                {language} · planned
              </li>
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
