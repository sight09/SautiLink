import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { cases, categories } from "@/db/schema";
import { EmptyState, PriorityPill, StatusPill, TrustBadge } from "@/components/ui";
import { CASE_STATUSES, STATUS_LABEL, relativeTime } from "@/lib/i18n";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case queue" };

type Search = Promise<{ status?: string; category?: string; priority?: string; q?: string; trust?: string }>;

export default async function InstitutionCases({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const session = await getSession();

  const filters: SQL[] = [];
  if (session?.role === "institution" && session.institutionId) {
    filters.push(eq(cases.institutionId, session.institutionId));
  }
  if (params.status) filters.push(eq(cases.status, params.status));
  if (params.category) filters.push(eq(cases.categorySlug, params.category));
  if (params.priority) filters.push(eq(cases.priority, params.priority));
  if (params.trust) filters.push(eq(cases.trustLevel, params.trust));
  if (params.q) filters.push(ilike(cases.title, `%${params.q}%`));

  const where = filters.length ? and(...filters) : undefined;

  const [rows, categoryRows, total] = await Promise.all([
    db.select().from(cases).where(where).orderBy(desc(cases.updatedAt)).limit(60),
    db.select().from(categories),
    db.select({ count: sql<number>`count(*)::int` }).from(cases).where(where),
  ]);

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={href + label}
      href={href}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        active ? "border-brand-600 bg-brand-700 text-white" : "border-sand-200 bg-white text-ink-700"
      }`}
    >
      {label}
    </Link>
  );

  const base = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { ...params, ...patch };
    Object.entries(merged).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    const query = next.toString();
    return `/institution/cases${query ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Case queue</h1>
        <p className="mt-1 text-sm text-ink-500">
          {total[0]?.count ?? 0} case(s) match these filters. Reporter identity is never shown.
        </p>
      </header>

      <form className="flex flex-wrap gap-2" action="/institution/cases">
        <label htmlFor="q" className="sr-only">
          Search case titles
        </label>
        <input
          id="q"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search case titles…"
          className="min-w-52 flex-1 rounded-xl border border-sand-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-600"
        />
        {params.status && <input type="hidden" name="status" value={params.status} />}
        {params.category && <input type="hidden" name="category" value={params.category} />}
        <button type="submit" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {chip("All statuses", base({ status: undefined }), !params.status)}
          {CASE_STATUSES.filter((s) => s !== "draft").map((status) =>
            chip(STATUS_LABEL[status].en, base({ status }), params.status === status),
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip("All categories", base({ category: undefined }), !params.category)}
          {categoryRows.map((category) =>
            chip(category.nameEn, base({ category: category.slug }), params.category === category.slug),
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {chip("Any priority", base({ priority: undefined }), !params.priority)}
          {["critical", "high", "medium", "low"].map((priority) =>
            chip(priority, base({ priority }), params.priority === priority),
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No cases match these filters"
          body="Try clearing a filter or searching a different term."
          cta={{ href: "/institution/cases", label: "Clear filters" }}
        />
      ) : (
        <div className="sl-card overflow-hidden">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">Cases assigned to this institution</caption>
            <thead className="bg-sand-100 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th scope="col" className="px-4 py-2.5">Case</th>
                <th scope="col" className="px-4 py-2.5">Area</th>
                <th scope="col" className="px-4 py-2.5">Priority</th>
                <th scope="col" className="px-4 py-2.5">Status</th>
                <th scope="col" className="px-4 py-2.5">Trust</th>
                <th scope="col" className="px-4 py-2.5">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-sand-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/institution/cases/${row.publicCaseId}`}
                      className="font-medium text-brand-900 underline-offset-2 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="block font-mono text-xs text-ink-500">{row.publicCaseId}</span>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{row.areaName}</td>
                  <td className="px-4 py-3">
                    <PriorityPill priority={row.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TrustBadge level={row.trustLevel} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{relativeTime(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
