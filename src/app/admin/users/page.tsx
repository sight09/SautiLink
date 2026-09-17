import { asc } from "drizzle-orm";
import { db } from "@/db";
import { institutions, users } from "@/db/schema";
import { AdminToggle } from "@/components/admin-actions";
import { formatDate } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users & institutions" };

export default async function AdminUsers() {
  const [userRows, institutionRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    db.select().from(institutions).orderBy(asc(institutions.name)),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Users &amp; institutions</h1>
        <p className="mt-1 text-sm text-ink-500">
          Accounts are only required for institution and administrator staff. Citizens never need one.
        </p>
      </header>

      <section className="sl-card overflow-x-auto">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Staff accounts
        </h2>
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-2">Name</th>
              <th scope="col" className="px-4 py-2">Email</th>
              <th scope="col" className="px-4 py-2">Role</th>
              <th scope="col" className="px-4 py-2">Institution</th>
              <th scope="col" className="px-4 py-2">Status</th>
              <th scope="col" className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {userRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5 font-medium text-ink-900">{row.name}</td>
                <td className="px-4 py-2.5 text-ink-700">{row.email}</td>
                <td className="px-4 py-2.5 capitalize text-ink-700">{row.role}</td>
                <td className="px-4 py-2.5 text-ink-700">
                  {institutionRows.find((i) => i.id === row.institutionId)?.shortName ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      row.status === "active"
                        ? "border-[#c6e6d5] bg-[#e6f4ec] text-[#14653f]"
                        : "border-[#f3cfcb] bg-[#fbe9e7] text-[#8c1d18]"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <AdminToggle
                    action="user.toggle"
                    id={row.id}
                    label={row.status === "active" ? "Suspend" : "Reactivate"}
                    danger={row.status === "active"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sl-card overflow-x-auto">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Institutions
        </h2>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th scope="col" className="px-4 py-2">Institution</th>
              <th scope="col" className="px-4 py-2">Coverage</th>
              <th scope="col" className="px-4 py-2">Categories</th>
              <th scope="col" className="px-4 py-2">SLA</th>
              <th scope="col" className="px-4 py-2">Added</th>
              <th scope="col" className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {institutionRows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink-900">{row.name}</span>
                  <span className="block text-xs text-ink-500">{row.type.replace(/-/g, " ")}</span>
                </td>
                <td className="px-4 py-2.5 text-ink-700">
                  {row.region}, {row.country}
                </td>
                <td className="px-4 py-2.5 text-ink-700">{(row.categories ?? []).join(", ")}</td>
                <td className="px-4 py-2.5 text-ink-700">{row.slaHours}h</td>
                <td className="px-4 py-2.5 text-ink-500">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-2.5 text-right">
                  <AdminToggle
                    action="institution.toggle"
                    id={row.id}
                    label={row.status === "active" ? "Suspend" : "Reactivate"}
                    danger={row.status === "active"}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-xs text-ink-500">
          Adding a country, region or institution only requires a new row here — routing, categories
          and languages are all data-driven, so expanding to another African country needs no code
          changes.
        </p>
      </section>
    </div>
  );
}
