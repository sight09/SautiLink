import { CaseView } from "@/components/case-view";

export const metadata = { title: "My case" };

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  return <CaseView publicCaseId={decodeURIComponent(publicId).toUpperCase()} />;
}
