"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";
import { relativeTime } from "@/lib/i18n";
import {
  getQueue,
  getSavedCases,
  removeQueued,
  updateQueued,
  type QueuedReport,
  type SavedCase,
} from "@/lib/offline-queue";

export default function CasesPage() {
  const { t, online, runSync, syncing, refreshPending, toast } = useApp();
  const [queue, setQueue] = useState<QueuedReport[]>([]);
  const [saved, setSaved] = useState<SavedCase[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const refresh = () => {
      setQueue(getQueue());
      setSaved(getSavedCases());
    };
    refresh();
    window.addEventListener("sautilink:storage", refresh);
    return () => window.removeEventListener("sautilink:storage", refresh);
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">{t("nav.cases")}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Cases and drafts stored on this device. Nothing here is shared until it is submitted.
        </p>
      </header>

      <section id="pending" aria-labelledby="pending-heading" className="scroll-mt-28">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="pending-heading" className="text-lg font-semibold tracking-tight text-brand-900">
            {t("cases.pending")}
          </h2>
          <button
            type="button"
            disabled={!online || syncing || queue.length === 0}
            onClick={() => void runSync()}
            className="rounded-lg border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-800 disabled:border-sand-200 disabled:text-ink-300"
          >
            {syncing ? t("offline.syncing") : "Retry sync"}
          </button>
        </div>

        {queue.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-200 px-4 py-6 text-center text-sm text-ink-500">
            Nothing waiting to be sent. Reports created while offline appear here.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => (
              <li key={item.localId} className="sl-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink-900">
                      {item.categorySlug.replace(/-/g, " ")} · {item.areaName}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      Saved {relativeTime(item.savedAt)} ·{" "}
                      {online ? (syncing ? t("offline.syncing") : "Ready to send") : t("offline.waiting")}
                      {item.attempts > 0 && ` · ${item.attempts} attempt(s)`}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#f3ddbe] bg-accent-100 px-2.5 py-1 text-xs font-medium text-accent-600">
                    {online ? "Queued" : "📡 Offline"}
                  </span>
                </div>

                {editing === item.localId ? (
                  <div className="mt-3 space-y-2">
                    <label htmlFor={`edit-${item.localId}`} className="sr-only">
                      Edit report description
                    </label>
                    <textarea
                      id={`edit-${item.localId}`}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          updateQueued(item.localId, { description: draft });
                          setEditing(null);
                          toast("Draft updated on this device.", "success");
                        }}
                        className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm font-semibold text-ink-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-ink-700">{item.description}</p>
                    {item.lastError && (
                      <p className="mt-1 text-xs text-accent-600">Last attempt: {item.lastError}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(item.localId);
                          setDraft(item.description);
                        }}
                        className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm font-semibold text-ink-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Delete this saved report? This cannot be undone.")) {
                            removeQueued(item.localId);
                            refreshPending();
                            toast("Saved report deleted from this device.", "info");
                          }
                        }}
                        className="rounded-lg border border-sand-200 px-3 py-1.5 text-sm font-semibold text-[#8c1d18]"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="submitted-heading">
        <h2 id="submitted-heading" className="mb-3 text-lg font-semibold tracking-tight text-brand-900">
          Submitted cases
        </h2>
        {saved.length === 0 ? (
          <EmptyState
            icon="📭"
            title={t("cases.empty.title")}
            body={t("cases.empty.body")}
            cta={{ href: "/report", label: t("action.report") }}
          />
        ) : (
          <ul className="space-y-2">
            {saved.map((item) => (
              <li key={item.publicCaseId} className="sl-card flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink-900">{item.title}</p>
                  <p className="font-mono text-xs text-ink-500">
                    {item.publicCaseId} · {relativeTime(item.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/case/${item.publicCaseId}`}
                  className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-500">
          Using a different phone?{" "}
          <Link href="/track" className="font-semibold text-brand-700 underline">
            Open a case with your Case ID
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
