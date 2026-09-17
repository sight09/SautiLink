import Link from "next/link";
import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { caseMessages, cases } from "@/db/schema";
import { EmptyState, StatusPill } from "@/components/ui";
import { formatDateTime } from "@/lib/i18n";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function InstitutionMessages() {
  const session = await getSession();
  const scope: SQL | undefined =
    session?.role === "institution" && session.institutionId
      ? eq(cases.institutionId, session.institutionId)
      : undefined;

  const caseRows = await db.select().from(cases).where(scope).orderBy(desc(cases.updatedAt)).limit(100);
  const ids = caseRows.map((row) => row.id);
  const messages = ids.length
    ? await db
        .select()
        .from(caseMessages)
        .where(and(inArray(caseMessages.caseId, ids), eq(caseMessages.senderType, "reporter")))
        .orderBy(desc(caseMessages.createdAt))
        .limit(30)
    : [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Messages</h1>
        <p className="mt-1 text-sm text-ink-500">
          Replies from reporters. Identities are never revealed — every thread stays inside its case.
        </p>
      </header>

      {messages.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No reporter replies yet"
          body="When an anonymous reporter answers a question, their reply appears here and inside the case."
          cta={{ href: "/institution/cases", label: "Open case queue" }}
        />
      ) : (
        <ul className="space-y-2">
          {messages.map((message) => {
            const parent = caseRows.find((row) => row.id === message.caseId)!;
            return (
              <li key={message.id} className="sl-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={`/institution/cases/${parent.publicCaseId}`}
                    className="font-semibold text-brand-900 underline-offset-2 hover:underline"
                  >
                    {parent.title}
                  </Link>
                  <StatusPill status={parent.status} />
                </div>
                <p className="mt-1 font-mono text-xs text-ink-500">
                  {parent.publicCaseId} · {message.senderLabel} · {formatDateTime(message.createdAt)}
                </p>
                <p className="mt-2 text-sm text-ink-900">{message.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
