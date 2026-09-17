import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { institutions } from "@/db/schema";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/institution", label: "Overview", icon: "01" },
  { href: "/institution/cases", label: "Cases", icon: "02" },
  { href: "/institution/messages", label: "Messages", icon: "03" },
  { href: "/institution/signals", label: "Community signals", icon: "04" },
  { href: "/institution/analytics", label: "Analytics", icon: "05" },
  { href: "/institution/settings", label: "Settings", icon: "06" },
];

export default async function InstitutionLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "institution" && session.role !== "admin") redirect("/");

  const institution = session.institutionId
    ? (await db.select().from(institutions).where(eq(institutions.id, session.institutionId)).limit(1))[0]
    : null;

  return (
    <DashboardShell
      nav={NAV}
      title="SautiLink"
      subtitle={institution?.shortName ?? "Institution desk"}
      userName={session.name}
    >
      {children}
    </DashboardShell>
  );
}
