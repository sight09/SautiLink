import { z } from "zod";
import { db } from "@/db";
import { smsInbox } from "@/db/schema";
import { createCase } from "@/lib/case-service";
import { clientKey, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * SMS FALLBACK PROTOTYPE.
 * No real SMS is transmitted. This endpoint accepts the exact payload shape an
 * SMS gateway webhook (e.g. Africa's Talking) would deliver, so the production
 * integration is a configuration change rather than a rewrite.
 * Format: "<KEYWORD> <AREA> <free text>"  e.g. "MAJI Kibera hakuna maji siku 14"
 */
const schema = z.object({
  from: z.string().min(4).max(24),
  body: z.string().min(6).max(320),
});

const KEYWORDS: Record<string, string> = {
  MAJI: "water",
  WATER: "water",
  ROAD: "roads",
  BARABARA: "roads",
  AFYA: "health",
  HEALTH: "health",
  SHULE: "education",
  SCHOOL: "education",
  USALAMA: "safety",
  SAFETY: "safety",
  TAKA: "public-facility",
  WASTE: "public-facility",
};

function maskNumber(value: string): string {
  const trimmed = value.replace(/\s+/g, "");
  return `${trimmed.slice(0, 5)}•••••${trimmed.slice(-3)}`;
}

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "sms"), 10, 60_000)) {
    return Response.json({ error: "Too many prototype messages." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Format: <KEYWORD> <AREA> <description>, e.g. MAJI Kibera hakuna maji siku 14" },
      { status: 400 },
    );
  }

  const parts = parsed.data.body.trim().split(/\s+/);
  const keyword = parts[0]?.toUpperCase() ?? "";
  const categorySlug = KEYWORDS[keyword] ?? "other";
  const areaWord = parts[1] ?? "Unknown";
  const areaName = `${areaWord.charAt(0).toUpperCase()}${areaWord.slice(1)}, Nairobi`;
  const description = parts.slice(2).join(" ") || parsed.data.body;

  if (description.length < 15) {
    return Response.json(
      { error: "The message is too short to create a case. Add a few more words of detail." },
      { status: 400 },
    );
  }

  const result = await createCase({
    categorySlug,
    description,
    areaName,
    anonymous: true,
    channel: "sms-prototype",
    language: /maji|hakuna|shule|barabara/i.test(parsed.data.body) ? "sw" : "en",
  });

  await db.insert(smsInbox).values({
    fromMasked: maskNumber(parsed.data.from),
    body: parsed.data.body,
    parsedCategory: categorySlug,
    createdCaseId: result.publicCaseId,
    simulated: true,
  });

  return Response.json(
    {
      prototype: true,
      publicCaseId: result.publicCaseId,
      accessCode: result.accessCode,
      categorySlug,
      areaName,
      reply: `SautiLink: case ${result.publicCaseId} created. Access code ${result.accessCode}. Reply STATUS ${result.publicCaseId} for updates. (Prototype - no SMS sent)`,
    },
    { status: 201 },
  );
}
