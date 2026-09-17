"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";
import { getQueue, getSavedCases, type QueuedReport, type SavedCase } from "@/lib/offline-queue";
import { relativeTime, type TranslationKey } from "@/lib/i18n";

const ACTIONS: Array<{
  href: string;
  icon: string;
  key: TranslationKey;
  sub: TranslationKey;
  primary?: boolean;
}> = [
  { href: "/report", icon: "01", key: "action.report", sub: "action.report.sub", primary: true },
  { href: "/assistant", icon: "02", key: "action.ask", sub: "action.ask.sub" },
  { href: "/track", icon: "03", key: "action.track", sub: "action.track.sub" },
  { href: "/services", icon: "04", key: "action.services", sub: "action.services.sub" },
];

export function HomeActions() {
  const { t, online, speak, speaking } = useApp();
  return (
    <section aria-labelledby="home-heading" className="sl-rise">
      <div className="rounded-2xl bg-brand-800 px-5 py-6 text-white sl-elevated">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-100">
          {t("app.tagline")}
        </p>
        <h1 id="home-heading" className="mt-2 text-2xl font-semibold leading-tight">
          {t("home.greeting")}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-100">{t("home.intro")}</p>
        <button
          type="button"
          onClick={() => speak(`${t("home.greeting")}. ${t("home.intro")}`)}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white"
        >
          <span aria-hidden className="font-mono text-[10px]">AUDIO</span>
          {speaking ? t("common.stop") : t("common.readAloud")}
        </button>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className={`flex min-h-[92px] items-start gap-3 rounded-2xl border px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                action.primary
                  ? "border-brand-600 bg-brand-50"
                  : "border-sand-200 bg-white"
              }`}
            >
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-700 font-mono text-xs font-semibold text-white">
                {action.icon}
              </span>
              <span>
                <span className="block font-semibold text-brand-900">{t(action.key)}</span>
                <span className="mt-0.5 block text-sm text-ink-500">{t(action.sub)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {!online && (
        <p className="mt-3 rounded-xl border border-[#f3ddbe] bg-accent-100 px-3 py-2 text-sm text-accent-600">
          {t("status.offline")} — {t("offline.saved")}
        </p>
      )}
    </section>
  );
}

export function DeviceCases() {
  const { t } = useApp();
  const [saved, setSaved] = useState<SavedCase[]>([]);
  const [queue, setQueue] = useState<QueuedReport[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSaved(getSavedCases().slice(0, 3));
      setQueue(getQueue());
      setReady(true);
    };
    refresh();
    window.addEventListener("sautilink:storage", refresh);
    return () => window.removeEventListener("sautilink:storage", refresh);
  }, []);

  if (!ready) return null;

  return (
    <section aria-labelledby="mycases-heading">
      <h2 id="mycases-heading" className="mb-3 text-lg font-semibold tracking-tight text-brand-900">
        {t("cases.mine")}
      </h2>
      {saved.length === 0 && queue.length === 0 ? (
        <EmptyState
          icon="—"
          title={t("cases.empty.title")}
          body={t("cases.empty.body")}
          cta={{ href: "/report", label: t("action.report") }}
        />
      ) : (
        <ul className="space-y-2">
          {queue.slice(0, 2).map((item) => (
            <li
              key={item.localId}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#f3ddbe] bg-accent-100 px-4 py-3"
            >
              <div>
                <p className="font-medium text-accent-600">{item.description.slice(0, 48)}…</p>
                <p className="text-xs text-accent-600">
                  {t("offline.waiting")} · {relativeTime(item.savedAt)}
                </p>
              </div>
              <Link href="/cases#pending" className="text-sm font-semibold text-accent-600 underline">
                View
              </Link>
            </li>
          ))}
          {saved.map((item) => (
            <li key={item.publicCaseId} className="sl-card flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-ink-900">{item.title}</p>
                <p className="font-mono text-xs text-ink-500">{item.publicCaseId}</p>
              </div>
              <Link
                href={`/case/${item.publicCaseId}`}
                className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white"
              >
                Open
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
