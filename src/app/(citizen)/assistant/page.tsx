"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useApp } from "@/components/app-shell";
import { AiNotice } from "@/components/ui";
import { formatDate } from "@/lib/i18n";

type Answer = {
  answer: string;
  confidence: "high" | "medium" | "unverified";
  sources: Array<{ name: string; organisation: string; reference: string; lastVerifiedAt: string }>;
  suggestedActions: Array<{ label: string; href: string }>;
};

type Entry = { question: string; answer?: Answer; error?: string };

const SUGGESTIONS = [
  "Can I report anonymously?",
  "How do I report a broken streetlight?",
  "What evidence should I provide?",
  "What happens after I submit a report?",
  "Who should I contact about no water?",
  "Does SautiLink work offline?",
];

export default function AssistantPage() {
  const { lang, online, speak, speaking, toast } = useApp();
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (value: string) => {
    const text = value.trim();
    if (text.length < 2) return;
    setQuestion("");
    setEntries((current) => [...current, { question: text }]);
    setLoading(true);
    if (!online) {
      setEntries((current) =>
        current.map((entry, index) =>
          index === current.length - 1
            ? { ...entry, error: "You're offline. Ask SautiLink needs a connection — your saved guidance below still works." }
            : entry,
        ),
      );
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, language: lang }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Assistant unavailable");
      setEntries((current) =>
        current.map((entry, index) =>
          index === current.length - 1 ? { ...entry, answer: payload as Answer } : entry,
        ),
      );
    } catch (error) {
      setEntries((current) =>
        current.map((entry, index) =>
          index === current.length - 1
            ? {
                ...entry,
                error:
                  error instanceof Error
                    ? error.message
                    : "Civic AI is temporarily unavailable. You can continue manually.",
              }
            : entry,
        ),
      );
      toast("Civic AI is temporarily unavailable.", "warn");
    } finally {
      setLoading(false);
      window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 60);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">Ask SautiLink</h1>
        <p className="mt-1 text-sm text-ink-500">
          Civic guidance drawn from configured, dated sources. If something cannot be verified,
          SautiLink says so instead of guessing.
        </p>
      </header>

      {entries.length === 0 && (
        <div className="sl-card p-4">
          <h2 className="text-sm font-semibold text-brand-900">Common questions</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => void ask(item)}
                  className="rounded-full border border-sand-200 bg-white px-3 py-1.5 text-sm text-ink-700 hover:border-brand-500"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-3">
        {entries.map((entry, index) => (
          <div key={index} className="space-y-2">
            <p className="ml-auto max-w-[85%] rounded-2xl bg-brand-700 px-4 py-2.5 text-sm text-white">
              {entry.question}
            </p>
            {entry.error ? (
              <p className="max-w-[92%] rounded-2xl border border-[#f3ddbe] bg-accent-100 px-4 py-3 text-sm text-accent-600">
                {entry.error}
              </p>
            ) : entry.answer ? (
              <article className="sl-card max-w-[92%] space-y-2 p-4 text-sm">
                <p className="whitespace-pre-line leading-relaxed text-ink-900">{entry.answer.answer}</p>
                {entry.answer.sources.length > 0 ? (
                  <div className="rounded-xl border border-sand-200 bg-sand-100 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sources</p>
                    <ul className="mt-1 space-y-1">
                      {entry.answer.sources.map((source) => (
                        <li key={source.name} className="text-xs text-ink-700">
                          <strong>{source.organisation}</strong> — {source.name} · {source.reference} ·
                          last verified {formatDate(source.lastVerifiedAt, lang)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-ink-500">
                    Information status: not matched to a verified source.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {entry.answer.suggestedActions.map((action) => (
                    <Link
                      key={action.href + action.label}
                      href={action.href}
                      className="rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-800"
                    >
                      {action.label}
                    </Link>
                  ))}
                  <button
                    type="button"
                    onClick={() => speak(entry.answer!.answer)}
                    className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
                  >
                    🔊 {speaking ? "Stop" : "Read aloud"}
                  </button>
                </div>
                <AiNotice>
                  AI-assisted answer. Confidence: {entry.answer.confidence}. SautiLink never invents
                  policies, contacts or legal advice.
                </AiNotice>
              </article>
            ) : (
              <div className="sl-skeleton h-20 max-w-[92%] rounded-2xl" aria-label="Thinking" />
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="sticky bottom-20 z-10 flex gap-2 rounded-2xl border border-sand-200 bg-white p-2 md:bottom-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="question" className="sr-only">
          Ask a civic question
        </label>
        <input
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about reporting, services or your rights…"
          className="flex-1 rounded-xl px-3 py-3 text-base outline-none"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length < 2}
          className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
