"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-shell";
import { StatusPill, Timeline, TrustBadge, PriorityPill } from "@/components/ui";
import { TRUST_EXPLAINER, formatDate, formatDateTime, type TrustLevel } from "@/lib/i18n";
import { findSavedCase, saveCase } from "@/lib/offline-queue";

type CaseData = {
  case: {
    publicCaseId: string;
    title: string;
    description: string;
    summary: string;
    categorySlug: string;
    status: string;
    trustLevel: string;
    priority: string;
    anonymous: boolean;
    areaName: string;
    locationNote: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
    aiNotes: string[];
    aiConfidence: number;
    channel: string;
  };
  evidence: Array<{ id: number; type: string; label: string; sizeBytes: number; createdAt: string }>;
  messages: Array<{ id: number; senderType: string; senderLabel: string; body: string; createdAt: string }>;
  history: Array<{ status: string; actorLabel: string; note: string; createdAt: string }>;
  institution: { name: string; shortName: string; contactEmail: string | null; slaHours: number } | null;
  relatedCount: number;
};

export function CaseView({ publicCaseId }: { publicCaseId: string }) {
  const { lang, online, toast, speak, speaking } = useApp();
  const [code, setCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [data, setData] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(
    async (accessCode: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/cases/${encodeURIComponent(publicCaseId)}?code=${encodeURIComponent(accessCode)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok) {
          setError(payload?.error ?? "We couldn't load this case.");
          setData(null);
        } else {
          setData(payload as CaseData);
          setCode(accessCode);
          if (accessCode) {
            saveCase({
              publicCaseId: payload.case.publicCaseId,
              accessCode,
              title: payload.case.title,
              categorySlug: payload.case.categorySlug,
              createdAt: payload.case.createdAt,
              anonymous: payload.case.anonymous,
            });
          }
        }
      } catch {
        setError(
          online
            ? "We couldn't reach the server. Please try again."
            : "You're offline. Case updates need a connection — your saved cases stay on this device.",
        );
      } finally {
        setLoading(false);
      }
    },
    [online, publicCaseId],
  );

  useEffect(() => {
    const saved = findSavedCase(publicCaseId);
    void load(saved?.accessCode ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicCaseId]);

  const sendReply = async () => {
    if (reply.trim().length < 2) return;
    setSending(true);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(publicCaseId)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: reply.trim(), accessCode: code }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Message failed");
      setReply("");
      toast("Reply sent anonymously.", "success");
      await load(code);
    } catch (sendError) {
      toast(sendError instanceof Error ? sendError.message : "We couldn't send that message.", "warn");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="sl-skeleton h-24 rounded-2xl" />
        <div className="sl-skeleton h-40 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="sl-card p-5">
          <h1 className="text-lg font-semibold text-brand-900">Access code required</h1>
          <p className="mt-1 text-sm text-ink-700">
            {error ?? "Enter the access code you received when you submitted this report."}
          </p>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void load(codeInput.trim().toUpperCase());
            }}
          >
            <label htmlFor="accessCode" className="sr-only">
              Access code for {publicCaseId}
            </label>
            <input
              id="accessCode"
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
              placeholder="e.g. SAUTI1"
              className="min-w-40 flex-1 rounded-xl border border-sand-200 bg-white px-3 py-3 font-mono tracking-[0.2em] outline-none focus:border-brand-600"
            />
            <button type="submit" className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white">
              Open case
            </button>
          </form>
        </div>
        <Link href="/track" className="text-sm font-semibold text-brand-700 underline">
          ← Back to case lookup
        </Link>
      </div>
    );
  }

  const c = data.case;
  const trustKey = (c.trustLevel in TRUST_EXPLAINER ? c.trustLevel : "community_reported") as TrustLevel;
  const spokenSummary = `Case ${c.publicCaseId}. ${c.title}. Status: ${c.status.replace(/_/g, " ")}. ${
    data.institution ? `Handled by ${data.institution.name}.` : ""
  }`;

  return (
    <div className="space-y-5">
      <header className="sl-card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={c.status} lang={lang} />
          <TrustBadge level={c.trustLevel} lang={lang} />
          <PriorityPill priority={c.priority} lang={lang} />
          {c.anonymous && (
            <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
              Identity protected
            </span>
          )}
        </div>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-brand-900">{c.title}</h1>
        <p className="mt-1 font-mono text-sm text-ink-500">{c.publicCaseId}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">{c.description}</p>
        <button
          type="button"
          onClick={() => speak(spokenSummary)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-medium text-ink-700"
        >
          {speaking ? "Stop" : "Read aloud"}
        </button>
      </header>

      <section className="sl-card overflow-hidden">
        <h2 className="border-b border-sand-200 bg-sand-100 px-4 py-2.5 text-sm font-semibold text-brand-900">
          Trust &amp; evidence
        </h2>
        <dl className="divide-y divide-sand-200 text-sm">
          {[
            ["Source", c.anonymous ? "Anonymous community report" : "Community report with contact"],
            ["Submitted", formatDate(c.createdAt, lang)],
            [
              "Evidence",
              data.evidence.length
                ? data.evidence.map((e) => e.label).join(", ")
                : "No evidence attached",
            ],
            ["Location", `${c.areaName} — approximate${c.locationNote ? ` (${c.locationNote})` : ""}`],
            ["Status", TRUST_EXPLAINER[trustKey][lang]],
            ["Related reports", `${data.relatedCount} in this area and category`],
            ["Last updated", formatDateTime(c.updatedAt, lang)],
            [
              "Official response",
              data.messages.some((m) => m.senderType === "institution")
                ? `Received from ${data.institution?.shortName ?? "institution"}`
                : "Not yet received",
            ],
            ["Channel", c.channel === "sms-prototype" ? "SMS fallback prototype" : c.channel],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3 px-4 py-2.5">
              <dt className="w-32 shrink-0 text-ink-500">{label}</dt>
              <dd className="text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-brand-900">Case timeline</h2>
        <div className="sl-card p-5">
          <Timeline entries={data.history} lang={lang} />
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-brand-900">
          Messages with {data.institution?.shortName ?? "the institution"}
        </h2>
        <p className="mb-3 text-sm text-ink-500">
          {c.anonymous
            ? "You are messaging anonymously. The institution sees “Anonymous reporter” only."
            : "The institution can also reach you using the contact you provided."}
        </p>
        <div className="space-y-2">
          {data.messages.length === 0 && (
            <p className="rounded-xl border border-dashed border-sand-200 px-4 py-6 text-center text-sm text-ink-500">
              No messages yet. If the institution needs more information, their question appears here.
            </p>
          )}
          {data.messages.map((message) => (
            <article
              key={message.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                message.senderType === "institution"
                  ? "border-sand-200 bg-white"
                  : "ml-6 border-brand-100 bg-brand-50"
              }`}
            >
              <p className="text-xs font-semibold text-ink-500">
                {message.senderLabel} · {formatDateTime(message.createdAt, lang)}
              </p>
              <p className="mt-1 leading-relaxed text-ink-900">{message.body}</p>
            </article>
          ))}
        </div>

        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendReply();
          }}
        >
          <label htmlFor="reply" className="block text-sm font-medium text-ink-900">
            Reply anonymously
          </label>
          <textarea
            id="reply"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="The issue is near the northern entrance…"
            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-600"
          />
          <button
            type="submit"
            disabled={sending || reply.trim().length < 2 || !online}
            className="rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:bg-ink-300"
          >
            {sending ? "Sending…" : online ? "Send reply" : "Offline — reply needs a connection"}
          </button>
        </form>
      </section>

      {c.aiNotes.length > 0 && (
        <section className="sl-card p-4">
          <h2 className="text-sm font-semibold text-brand-900">AI-assisted analysis</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            {c.aiNotes.map((note, index) => (
              <li key={index}>• {note}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-500">
            AI-assisted recommendations support human review. They are not findings of fact and never
            determine responsibility.
          </p>
        </section>
      )}
    </div>
  );
}
