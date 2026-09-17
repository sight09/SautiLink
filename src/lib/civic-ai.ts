/**
 * SautiLink Civic AI Engine (rules + lexical scoring, fully deterministic).
 *
 * Why not an LLM by default? The pilot contexts have unreliable connectivity and
 * no guaranteed API budget. This engine runs server-side in milliseconds, never
 * fabricates institutions or policies (it can only reference configured records),
 * and is explainable — every suggestion returns the evidence that produced it.
 * `LLM_PROVIDER_HOOK` in docs/ARCHITECTURE.md describes the pluggable upgrade path.
 */

export type Priority = "low" | "medium" | "high" | "critical";

export type ClassificationInput = {
  text: string;
  selectedCategory?: string | null;
  categories: Array<{ slug: string; nameEn: string; keywords: string[]; sensitive: boolean }>;
};

export type Classification = {
  categorySlug: string;
  confidence: number;
  priority: Priority;
  priorityReason: string;
  summary: string;
  title: string;
  matchedTerms: string[];
  deEscalation: string | null;
  sensitive: boolean;
};

const CRITICAL_TERMS = [
  "collapse",
  "collapsed",
  "fire",
  "gunshot",
  "dying",
  "died",
  "death",
  "bleeding",
  "trapped",
  "cholera",
  "outbreak",
  "hatari",
  "moto",
  "kifo",
];
const HIGH_TERMS = [
  "child",
  "children",
  "school",
  "hospital",
  "clinic",
  "no water",
  "two weeks",
  "sewage",
  "electric",
  "assault",
  "violence",
  "flood",
  "maji",
  "wiki mbili",
  "shule",
  "hospitali",
  "mafuriko",
];
const LOW_TERMS = ["suggestion", "minor", "question", "swali", "pendekezo"];

const BLAME_PATTERNS = [
  /\b(they|them|those people|that (tribe|clan|group|community))\b.*\b(steal|stealing|taking|hoarding|divert)\b/i,
  /\b(tribe|clan|ethnic|foreigners|refugees|migrants)\b/i,
  /\bwanaiba\b/i,
];

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function classify(input: ClassificationInput): Classification {
  const text = normalise(input.text);
  const matched: string[] = [];

  let best = { slug: input.selectedCategory ?? "other", score: 0 };
  for (const category of input.categories) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (keyword && text.includes(keyword.toLowerCase())) {
        score += keyword.includes(" ") ? 3 : 2;
        matched.push(keyword);
      }
    }
    if (category.slug === input.selectedCategory) score += 3;
    if (score > best.score) best = { slug: category.slug, score };
  }

  const confidence = Math.max(
    38,
    Math.min(96, 42 + best.score * 9 + (input.selectedCategory === best.slug ? 12 : 0)),
  );

  let priority: Priority = "medium";
  let priorityReason = "Standard service disruption timeframe.";
  if (LOW_TERMS.some((t) => text.includes(t)) && text.length < 140) {
    priority = "low";
    priorityReason = "Reads as an enquiry or minor issue.";
  }
  const highHit = HIGH_TERMS.find((t) => text.includes(t));
  if (highHit) {
    priority = "high";
    priorityReason = `Mentions a vulnerable group or prolonged disruption ("${highHit}").`;
  }
  const criticalHit = CRITICAL_TERMS.find((t) => text.includes(t));
  if (criticalHit) {
    priority = "critical";
    priorityReason = `Possible immediate risk to life or health ("${criticalHit}").`;
  }

  const selected = input.categories.find((c) => c.slug === best.slug);
  if (selected?.sensitive && priority === "medium") {
    priority = "high";
    priorityReason = "Sensitive category — routed for faster human review.";
  }

  const sentences = input.text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .filter(Boolean);
  const summary =
    sentences.slice(0, 2).join(" ").slice(0, 240) ||
    input.text.slice(0, 200) ||
    "Community report submitted without narrative detail.";

  const title =
    (sentences[0] ?? input.text)
      .split(" ")
      .slice(0, 9)
      .join(" ")
      .replace(/[.,;:]$/, "") || "Community report";

  const deEscalation = BLAME_PATTERNS.some((p) => p.test(input.text))
    ? "This report appears to involve a shared-resource or inter-group concern. SautiLink records the service problem and the evidence, not accusations against a group. Consider describing what service failed, when, and where — that is what an institution can act on."
    : null;

  return {
    categorySlug: best.slug,
    confidence,
    priority,
    priorityReason,
    summary,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    matchedTerms: Array.from(new Set(matched)).slice(0, 6),
    deEscalation,
    sensitive: Boolean(selected?.sensitive),
  };
}

export type InstitutionCandidate = {
  id: number;
  name: string;
  shortName: string;
  categories: string[];
  areas: string[];
  region: string;
  type: string;
};

export type InstitutionMatch = {
  institutionId: number;
  name: string;
  shortName: string;
  score: number;
  reasons: string[];
};

export function matchInstitutions(
  categorySlug: string,
  areaName: string,
  candidates: InstitutionCandidate[],
): InstitutionMatch[] {
  const area = normalise(areaName);
  const scored = candidates.map((institution) => {
    const reasons: string[] = [];
    let score = 20;
    if (institution.categories.includes(categorySlug)) {
      score += 45;
      reasons.push("Handles this issue category");
    }
    if (institution.areas.some((a) => normalise(a) === area)) {
      score += 30;
      reasons.push("Operates in the reported area");
    } else if (institution.areas.some((a) => area.includes(normalise(a)) || normalise(a).includes(area))) {
      score += 16;
      reasons.push("Operates nearby");
    }
    if (institution.type === "utility" && categorySlug === "water") {
      score += 4;
      reasons.push("Service-type alignment");
    }
    return {
      institutionId: institution.id,
      name: institution.name,
      shortName: institution.shortName,
      score: Math.min(97, score),
      reasons,
    };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export type DuplicateCandidate = {
  publicCaseId: string;
  categorySlug: string;
  areaName: string;
  title: string;
  createdAt: Date | string;
};

export function findRelated(
  categorySlug: string,
  areaName: string,
  candidates: DuplicateCandidate[],
): DuplicateCandidate[] {
  const area = normalise(areaName);
  return candidates
    .filter((c) => c.categorySlug === categorySlug && normalise(c.areaName) === area)
    .slice(0, 8);
}

/* ------------------------------- Ask SautiLink ------------------------------ */

export type KnowledgeEntry = {
  id: number;
  name: string;
  organisation: string;
  reference: string;
  summaryEn: string;
  summarySw: string;
  keywords: string[];
  lastVerifiedAt: Date | string;
  status: string;
  categorySlug: string;
};

export type AssistantAnswer = {
  answer: string;
  confidence: "high" | "medium" | "unverified";
  sources: Array<{ name: string; organisation: string; reference: string; lastVerifiedAt: string }>;
  suggestedActions: Array<{ label: string; href: string }>;
};

const PROCEDURAL_ANSWERS: Array<{
  test: RegExp;
  en: string;
  sw: string;
  actions: Array<{ label: string; href: string }>;
}> = [
  {
    test: /anonym|siri|jina langu|identity|privacy|faragha/i,
    en: "Yes. Choose “Report anonymously” in step 4 of the reporting flow. SautiLink stores the case content separately from any identity data, institutions only ever see “Anonymous reporter”, and you receive a Case ID plus a private access code to follow up. We do not ask for your name, phone number, or email on anonymous reports.",
    sw: "Ndiyo. Chagua “Ripoti bila kujitambulisha” katika hatua ya 4. SautiLink huhifadhi maelezo ya kesi mbali na taarifa za utambulisho, taasisi huona “Mtoa taarifa asiyejulikana” pekee, na utapata Nambari ya Kesi pamoja na msimbo wa siri wa kufuatilia.",
    actions: [
      { label: "Start a safe report", href: "/report" },
      { label: "How we protect you", href: "/settings#privacy" },
    ],
  },
  {
    test: /after (i )?(submit|report)|what happens|nini kitatokea|baada ya/i,
    en: "After you submit: (1) SautiLink creates the case and gives you a Case ID, (2) the civic engine suggests a category, urgency and the likely responsible institution, (3) the institution is notified and can ask you questions anonymously, (4) every status change is added to your case timeline until the case is resolved or closed.",
    sw: "Baada ya kuwasilisha: (1) SautiLink hutengeneza kesi na kukupa Nambari ya Kesi, (2) injini ya kiraia hupendekeza kundi, uharaka na taasisi husika, (3) taasisi hupewa taarifa na inaweza kukuuliza maswali bila kujua wewe ni nani, (4) kila mabadiliko huonekana kwenye ratiba ya kesi hadi itatuliwe.",
    actions: [{ label: "Track a case", href: "/track" }],
  },
  {
    test: /evidence|photo|picha|ushahidi|document|nyaraka/i,
    en: "Useful evidence is anything that shows what failed, where and when: a photo of the broken facility or dry tap, a photo of an official notice, a receipt or reference number, and the date the problem started. Never photograph people without consent, and never put yourself at risk to collect evidence. Evidence stays private — it is visible only to you and the handling institution.",
    sw: "Ushahidi muhimu ni kitu chochote kinachoonyesha tatizo: picha ya kituo kilichoharibika, tangazo rasmi, risiti au nambari ya kumbukumbu, na tarehe tatizo lilipoanza. Usipige picha watu bila ridhaa, wala usijiweke hatarini. Ushahidi hubaki wa siri.",
    actions: [{ label: "Report with evidence", href: "/report" }],
  },
  {
    test: /offline|no internet|hakuna mtandao|connection|mtandao/i,
    en: "SautiLink works offline. Open the app, write your report and save it — it is stored encrypted-at-rest on your device in the Pending Reports queue. Nothing is sent while you are offline, so we never pretend an institution has received it. When connectivity returns, the queue synchronises and your Case ID is generated at that moment.",
    sw: "SautiLink hufanya kazi bila mtandao. Andika ripoti yako na uihifadhi — itakaa kwenye foleni ya “Ripoti Zinazosubiri” kwenye simu yako. Mtandao ukirudi, itatumwa na utapata Nambari ya Kesi.",
    actions: [{ label: "Pending reports", href: "/cases#pending" }],
  },
  {
    test: /who (should|do) i contact|responsible|taasisi|contact/i,
    en: "SautiLink matches your report to configured institutions using the issue category and the area you select, and shows a match score with the reasons for the match. You can review the suggestion and change it before submitting. Directory entries and their contact details are in Find a Service.",
    sw: "SautiLink hulinganisha ripoti yako na taasisi kulingana na aina ya tatizo na eneo, na huonyesha kiwango cha ulinganifu pamoja na sababu. Unaweza kubadilisha pendekezo kabla ya kuwasilisha.",
    actions: [{ label: "Find a service", href: "/services" }],
  },
];

export function answerQuestion(
  question: string,
  language: "en" | "sw",
  knowledge: KnowledgeEntry[],
): AssistantAnswer {
  const q = normalise(question);
  const scored = knowledge
    .map((entry) => {
      let score = 0;
      for (const keyword of entry.keywords) {
        if (keyword && q.includes(keyword.toLowerCase())) score += 3;
      }
      if (q.includes(entry.categorySlug)) score += 2;
      if (q.includes(normalise(entry.organisation))) score += 2;
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const sources = scored.map(({ entry }) => ({
    name: entry.name,
    organisation: entry.organisation,
    reference: entry.reference,
    lastVerifiedAt: new Date(entry.lastVerifiedAt).toISOString(),
  }));

  const procedural = PROCEDURAL_ANSWERS.find((p) => p.test.test(question));

  if (procedural) {
    const base = language === "sw" ? procedural.sw : procedural.en;
    const extra = scored.length
      ? `\n\n${language === "sw" ? "Taarifa rasmi inayohusiana" : "Related official information"}: ${
          language === "sw" ? scored[0].entry.summarySw : scored[0].entry.summaryEn
        }`
      : "";
    return {
      answer: base + extra,
      confidence: scored.length ? "high" : "medium",
      sources,
      suggestedActions: procedural.actions,
    };
  }

  if (scored.length) {
    const top = scored[0].entry;
    return {
      answer: language === "sw" ? top.summarySw : top.summaryEn,
      confidence: "high",
      sources,
      suggestedActions: [
        { label: language === "sw" ? "Ripoti suala hili" : "Report this issue", href: "/report" },
        { label: language === "sw" ? "Tafuta huduma" : "Find a service", href: "/services" },
      ],
    };
  }

  return {
    answer:
      language === "sw"
        ? "Sikuweza kuthibitisha taarifa hii kutoka vyanzo vilivyothibitishwa vya SautiLink. Tafadhali angalia orodha ya huduma rasmi, au wasilisha ripoti ili taasisi husika ijibu moja kwa moja."
        : "I couldn't verify this from SautiLink's trusted sources, so I won't guess. Please check the official service directory, or submit a report so the responsible institution can answer you directly.",
    confidence: "unverified",
    sources: [],
    suggestedActions: [
      { label: language === "sw" ? "Tafuta huduma" : "Find a service", href: "/services" },
      { label: language === "sw" ? "Ripoti kwa usalama" : "Report safely", href: "/report" },
    ],
  };
}
