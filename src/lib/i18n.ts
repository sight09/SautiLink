export type Lang = "en" | "sw";

export const LANGUAGES: Array<{ code: Lang; label: string; native: string }> = [
  { code: "en", label: "English", native: "English" },
  { code: "sw", label: "Swahili", native: "Kiswahili" },
];

/**
 * Localisation is dictionary-driven so new languages (Amharic, Afaan Oromo,
 * Hausa, Yoruba, isiZulu, French, Arabic, Portuguese) only require a new object
 * here plus an entry in LANGUAGES — no component changes.
 */
const dict = {
  "app.name": { en: "SautiLink", sw: "SautiLink" },
  "app.tagline": { en: "Speak safely. Track change.", sw: "Sema kwa usalama. Fuatilia mabadiliko." },
  "nav.home": { en: "Home", sw: "Mwanzo" },
  "nav.cases": { en: "Cases", sw: "Kesi" },
  "nav.report": { en: "Report", sw: "Ripoti" },
  "nav.assistant": { en: "Assistant", sw: "Msaidizi" },
  "nav.settings": { en: "Settings", sw: "Mipangilio" },
  "home.greeting": { en: "What would you like to do?", sw: "Ungependa kufanya nini?" },
  "home.intro": {
    en: "Report a public-service or safety problem, understand what to do next, and follow your case until it is resolved.",
    sw: "Ripoti tatizo la huduma au usalama, elewa hatua inayofuata, na fuatilia kesi yako hadi itatuliwe.",
  },
  "action.report": { en: "Report safely", sw: "Ripoti kwa usalama" },
  "action.report.sub": {
    en: "Anonymous or named. Works offline.",
    sw: "Bila jina au kwa jina. Hufanya kazi bila mtandao.",
  },
  "action.ask": { en: "Ask SautiLink", sw: "Uliza SautiLink" },
  "action.ask.sub": {
    en: "What to do, who is responsible, your rights.",
    sw: "Nini cha kufanya, nani anahusika, haki zako.",
  },
  "action.track": { en: "Check my case", sw: "Angalia kesi yangu" },
  "action.track.sub": { en: "Use your Case ID and access code.", sw: "Tumia Nambari ya Kesi na msimbo." },
  "action.services": { en: "Find a service", sw: "Tafuta huduma" },
  "action.services.sub": {
    en: "Institutions, contacts and official information.",
    sw: "Taasisi, mawasiliano na taarifa rasmi.",
  },
  "status.online": { en: "Online", sw: "Mtandaoni" },
  "status.offline": { en: "Offline", sw: "Hakuna mtandao" },
  "status.lite": { en: "Lite Mode", sw: "Hali Nyepesi" },
  "privacy.protected": { en: "Identity protected", sw: "Utambulisho umelindwa" },
  "cases.mine": { en: "My cases on this device", sw: "Kesi zangu kwenye kifaa hiki" },
  "cases.pending": { en: "Pending reports", sw: "Ripoti zinazosubiri" },
  "cases.empty.title": { en: "No cases yet", sw: "Hakuna kesi bado" },
  "cases.empty.body": {
    en: "When you submit a report, you'll be able to track its progress here.",
    sw: "Ukiwasilisha ripoti, utaweza kufuatilia maendeleo yake hapa.",
  },
  "offline.saved": {
    en: "Your report has been saved securely on this device and will be submitted when a connection becomes available.",
    sw: "Ripoti yako imehifadhiwa kwa usalama kwenye kifaa hiki na itatumwa mtandao utakaporudi.",
  },
  "offline.restored": { en: "Connection restored", sw: "Mtandao umerudi" },
  "offline.syncing": { en: "Synchronising…", sw: "Inasawazisha…" },
  "offline.waiting": { en: "Waiting for connection", sw: "Inasubiri mtandao" },
  "submit.success": { en: "Submitted successfully", sw: "Imewasilishwa kwa mafanikio" },
  "report.step": { en: "Step", sw: "Hatua" },
  "report.of": { en: "of", sw: "kati ya" },
  "common.next": { en: "Continue", sw: "Endelea" },
  "common.back": { en: "Back", sw: "Rudi" },
  "common.submit": { en: "Submit report", sw: "Wasilisha ripoti" },
  "common.copy": { en: "Copy", sw: "Nakili" },
  "common.copied": { en: "Copied", sw: "Imenakiliwa" },
  "common.loading": { en: "Loading…", sw: "Inapakia…" },
  "common.readAloud": { en: "Read aloud", sw: "Soma kwa sauti" },
  "common.stop": { en: "Stop", sw: "Simamisha" },
} satisfies Record<string, Record<Lang, string>>;

export type TranslationKey = keyof typeof dict;

export function translate(key: TranslationKey, lang: Lang): string {
  return dict[key][lang] ?? dict[key].en;
}

/* ---------------------------- domain vocabulary ---------------------------- */

export const CASE_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "info_needed",
  "responded",
  "in_progress",
  "resolved",
  "closed",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const STATUS_LABEL: Record<CaseStatus, Record<Lang, string>> = {
  draft: { en: "Draft", sw: "Rasimu" },
  submitted: { en: "Submitted", sw: "Imewasilishwa" },
  under_review: { en: "Under review", sw: "Inapitiwa" },
  info_needed: { en: "More information needed", sw: "Taarifa zaidi zinahitajika" },
  responded: { en: "Institution responded", sw: "Taasisi imejibu" },
  in_progress: { en: "In progress", sw: "Inaendelea" },
  resolved: { en: "Resolved", sw: "Imetatuliwa" },
  closed: { en: "Closed", sw: "Imefungwa" },
};

export const STATUS_TONE: Record<CaseStatus, string> = {
  draft: "bg-sand-100 text-ink-700 border-sand-200",
  submitted: "bg-brand-50 text-brand-800 border-brand-100",
  under_review: "bg-[#eaf2fb] text-[#12507f] border-[#cfe1f4]",
  info_needed: "bg-accent-100 text-accent-600 border-[#f3ddbe]",
  responded: "bg-[#eaf2fb] text-[#12507f] border-[#cfe1f4]",
  in_progress: "bg-brand-50 text-brand-700 border-brand-100",
  resolved: "bg-[#e6f4ec] text-[#14653f] border-[#c6e6d5]",
  closed: "bg-sand-100 text-ink-700 border-sand-200",
};

export const TRUST_LEVELS = [
  "community_reported",
  "evidence_submitted",
  "community_corroborated",
  "institution_responded",
  "verified",
] as const;

export type TrustLevel = (typeof TRUST_LEVELS)[number];

export const TRUST_LABEL: Record<TrustLevel, Record<Lang, string>> = {
  community_reported: { en: "Community reported", sw: "Imeripotiwa na jamii" },
  evidence_submitted: { en: "Evidence submitted", sw: "Ushahidi umewasilishwa" },
  community_corroborated: { en: "Community corroborated", sw: "Imethibitishwa na jamii" },
  institution_responded: { en: "Institution responded", sw: "Taasisi imejibu" },
  verified: { en: "Verified", sw: "Imehakikiwa" },
};

export const TRUST_EXPLAINER: Record<TrustLevel, Record<Lang, string>> = {
  community_reported: {
    en: "Submitted by a community member. Not yet independently checked.",
    sw: "Imewasilishwa na mwananchi. Bado haijathibitishwa kwa kujitegemea.",
  },
  evidence_submitted: {
    en: "Supporting material is attached to this case.",
    sw: "Vielelezo vimeambatishwa kwenye kesi hii.",
  },
  community_corroborated: {
    en: "Multiple independent reports describe a similar issue in this area.",
    sw: "Ripoti kadhaa huru zinaeleza tatizo linalofanana katika eneo hili.",
  },
  institution_responded: {
    en: "A responsible institution has provided an official response.",
    sw: "Taasisi husika imetoa jibu rasmi.",
  },
  verified: {
    en: "Report, evidence and institutional response are consistent.",
    sw: "Ripoti, ushahidi na jibu la taasisi vinalingana.",
  },
};

export const PRIORITY_LABEL: Record<string, Record<Lang, string>> = {
  low: { en: "Low", sw: "Chini" },
  medium: { en: "Medium", sw: "Wastani" },
  high: { en: "High", sw: "Juu" },
  critical: { en: "Critical", sw: "Hatari kubwa" },
};

export const PRIORITY_TONE: Record<string, string> = {
  low: "bg-sand-100 text-ink-700 border-sand-200",
  medium: "bg-[#eaf2fb] text-[#12507f] border-[#cfe1f4]",
  high: "bg-accent-100 text-accent-600 border-[#f3ddbe]",
  critical: "bg-[#fbe9e7] text-[#8c1d18] border-[#f3cfcb]",
};

export function formatDate(value: string | Date, lang: Lang = "en"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-KE" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string | Date, lang: Lang = "en"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(lang === "sw" ? "sw-KE" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function relativeTime(value: string | Date, lang: Lang = "en"): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(lang === "sw" ? "sw" : "en", { numeric: "auto" });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}
