import { clearSession } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return Response.json({ ok: true });
}
