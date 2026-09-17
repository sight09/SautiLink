import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, institutions } from "@/db/schema";
import { ReportWizard } from "@/components/report-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Report safely" };

export default async function ReportPage() {
  const categoryRows = await db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.sortOrder));

  const institutionRows = await db.select().from(institutions).where(eq(institutions.status, "active"));
  const areas = Array.from(new Set(institutionRows.flatMap((i) => i.areas ?? []))).sort();

  return (
    <ReportWizard
      categories={categoryRows.map((c) => ({
        slug: c.slug,
        nameEn: c.nameEn,
        nameSw: c.nameSw,
        descriptionEn: c.descriptionEn,
        descriptionSw: c.descriptionSw,
        icon: c.icon,
        sensitive: c.sensitive,
      }))}
      areas={areas.length ? areas : ["Nairobi"]}
    />
  );
}
