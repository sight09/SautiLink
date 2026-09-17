"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-shell";
import { LANGUAGES } from "@/lib/i18n";
import { getQueue, getSavedCases } from "@/lib/offline-queue";

export default function SettingsPage() {
  const { lang, setLang, lite, setLite, online, t, toast, speak, speaking } = useApp();
  const [counts, setCounts] = useState({ queue: 0, cases: 0 });
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    setCounts({ queue: getQueue().length, cases: getSavedCases().length });
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallable(true);
      (window as unknown as { __slPrompt?: Event }).__slPrompt = event;
    };
    const installedHandler = () => setInstallable(false);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">{t("nav.settings")}</h1>
        <p className="mt-1 text-sm text-ink-500">Language, data use, accessibility and privacy.</p>
      </header>

      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Language</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {LANGUAGES.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => {
                setLang(option.code);
                toast(`Language set to ${option.native}.`, "success");
              }}
              aria-pressed={lang === option.code}
              className={`rounded-xl border px-4 py-3 text-left font-medium ${
                lang === option.code ? "border-brand-600 bg-brand-50 text-brand-900" : "border-sand-200 bg-white text-ink-700"
              }`}
            >
              {option.native}
              <span className="block text-xs font-normal text-ink-500">{option.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-500">
          More languages (Amharic, Afaan Oromo, Hausa, Yoruba, isiZulu, French, Arabic, Portuguese) can
          be added through the dictionary layer without code changes.
        </p>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Data &amp; connectivity</h2>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="font-medium text-ink-900">Lite Mode</p>
            <p className="text-sm text-ink-500">
              Suppresses images, animations and heavy requests. Photos are compressed harder before
              upload.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={lite}
            onClick={() => setLite(!lite)}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${lite ? "bg-brand-600" : "bg-sand-200"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${lite ? "left-7" : "left-1"}`}
            />
            <span className="sr-only">Toggle Lite Mode</span>
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-sand-100 px-2 py-2">
            <dt className="text-xs text-ink-500">Connection</dt>
            <dd className="font-semibold text-ink-900">{online ? t("status.online") : t("status.offline")}</dd>
          </div>
          <div className="rounded-xl bg-sand-100 px-2 py-2">
            <dt className="text-xs text-ink-500">Pending</dt>
            <dd className="font-semibold text-ink-900">{counts.queue}</dd>
          </div>
          <div className="rounded-xl bg-sand-100 px-2 py-2">
            <dt className="text-xs text-ink-500">Saved cases</dt>
            <dd className="font-semibold text-ink-900">{counts.cases}</dd>
          </div>
        </dl>
        {installable && (
          <button
            type="button"
            onClick={async () => {
              const prompt = (window as unknown as { __slPrompt?: { prompt: () => Promise<void> } }).__slPrompt;
              await prompt?.prompt();
            }}
            className="mt-3 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Install SautiLink on this device
          </button>
        )}
      </section>

      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Accessibility</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
          <li>• Read aloud is available on key screens using your device voice.</li>
          <li>• Every control is keyboard reachable with a visible focus ring.</li>
          <li>• Animations automatically stop if your device requests reduced motion.</li>
          <li>• Touch targets are at least 44px and icons are always paired with text.</li>
        </ul>
        <button
          type="button"
          onClick={() =>
            speak(
              "SautiLink settings. You can change language, turn on Lite Mode for low bandwidth, and review how your privacy is protected.",
            )
          }
          className="mt-2 rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
        >
          🔊 {speaking ? "Stop" : "Test read aloud"}
        </button>
      </section>

      <section id="privacy" className="sl-card scroll-mt-28 p-4">
        <h2 className="text-sm font-semibold text-brand-900">Privacy</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
          <li>• Anonymous cases store no account link, name, phone or email.</li>
          <li>• Case access codes are stored hashed; we cannot read or recover them.</li>
          <li>• Institutions see “Anonymous reporter”, an approximate area, and your evidence only.</li>
          <li>• Sensitive categories are excluded from all public dashboards.</li>
          <li>
            • Honest limitation: this is a pilot. Hosting infrastructure can observe network metadata,
            and evidence is stored in the application database rather than a hardened object store.
          </li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Remove all SautiLink data stored on this device?")) {
                window.localStorage.removeItem("sautilink.cases.v1");
                window.localStorage.removeItem("sautilink.queue.v1");
                window.dispatchEvent(new CustomEvent("sautilink:storage"));
                setCounts({ queue: 0, cases: 0 });
                toast("Local SautiLink data cleared from this device.", "success");
              }
            }}
            className="rounded-xl border border-sand-200 px-4 py-2.5 text-sm font-semibold text-[#8c1d18]"
          >
            Clear data on this device
          </button>
          <Link
            href="/login"
            className="rounded-xl border border-sand-200 px-4 py-2.5 text-sm font-semibold text-ink-700"
          >
            Institution / admin sign-in
          </Link>
        </div>
      </section>
    </div>
  );
}
