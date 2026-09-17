import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSession } from "@/lib/security";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview", icon: "01" },
  { href: "/admin/users", label: "Users & institutions", icon: "02" },
  { href: "/admin/config", label: "Categories & sources", icon: "03" },
  { href: "/admin/moderation", label: "Moderation & audit", icon: "04" },
  { href: "/institution", label: "Institution view", icon: "05" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  return (
    <DashboardShell nav={NAV} title="SautiLink" subtitle="Platform administration" userName={session.name}>
      {children}
    </DashboardShell>
  );
}
