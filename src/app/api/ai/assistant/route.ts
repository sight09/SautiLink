import { z } from "zod";
import { db } from "@/db";
import { trustedSources } from "@/db/schema";
import { answerQuestion } from "@/lib/civic-ai";
import { clientKey, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(2).max(600),
  language: z.enum(["en", "sw"]).optional().default("en"),
});

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "ai-assistant"), 25, 60_000)) {
    return Response.json({ error: "Please wait a moment before asking again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please type a question." }, { status: 400 });

  try {
    const sources = await db.select().from(trustedSources);
    const answer = answerQuestion(
      parsed.data.question,
      parsed.data.language,
      sources.map((s) => ({
        id: s.id,
        name: s.name,
        organisation: s.organisation,
        reference: s.reference,
        summaryEn: s.summaryEn,
        summarySw: s.summarySw,
        keywords: s.keywords ?? [],
        lastVerifiedAt: s.lastVerifiedAt,
        status: s.status,
        categorySlug: s.categorySlug,
      })),
    );
    return Response.json(answer);
  } catch (error) {
    console.error("ai.assistant.failed", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "Civic AI is temporarily unavailable. You can continue manually." },
      { status: 503 },
    );
  }
}
