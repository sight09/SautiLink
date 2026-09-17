"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { LANGUAGES, translate, type Lang, type TranslationKey } from "@/lib/i18n";
import { getQueue, syncQueue, type SavedCase } from "@/lib/offline-queue";

type Toast = { id: number; message: string; tone: "info" | "success" | "warn" };

type AppContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  online: boolean;
  lite: boolean;
  setLite: (value: boolean) => void;
  pendingCount: number;
  refreshPending: () => void;
  syncing: boolean;
  runSync: () => Promise<SavedCase[]>;
  toast: (message: string, tone?: Toast["tone"]) => void;
  speak: (text: string) => void;
  speaking: boolean;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [online, setOnline] = useState(true);
  const [lite, setLiteState] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [speaking, setSpeaking] = useState(false);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((c) => c.filter((x) => x.id !== id)), 4800);
  }, []);

  const refreshPending = useCallback(() => setPendingCount(getQueue().length), []);

  const runSync = useCallback(async () => {
    if (getQueue().length === 0) return [];
    setSyncing(true);
    const result = await syncQueue();
    setSyncing(false);
    refreshPending();
    if (result.synced.length > 0) {
      toast(
        `${result.synced.length} report${result.synced.length > 1 ? "s" : ""} submitted successfully`,
        "success",
      );
    }
    if (result.failed > 0) toast("Some reports could not be synchronised yet.", "warn");
    return result.synced;
  }, [refreshPending, toast]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    window.localStorage.setItem("sautilink.lang", next);
    document.documentElement.lang = next;
  }, []);

  const setLite = useCallback((value: boolean) => {
    setLiteState(value);
    window.localStorage.setItem("sautilink.lite", value ? "on" : "off");
    document.documentElement.dataset.lite = value ? "on" : "off";
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        toast("Read aloud is not supported on this device.", "warn");
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "sw" ? "sw-KE" : "en-GB";
      utterance.rate = 0.98;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [lang, toast],
  );

  useEffect(() => {
    const storedLang = window.localStorage.getItem("sautilink.lang") as Lang | null;
    if (storedLang === "en" || storedLang === "sw") {
      setLangState(storedLang);
      document.documentElement.lang = storedLang;
    }
    const storedLite = window.localStorage.getItem("sautilink.lite");
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } })
      .connection;
    const slow =
      connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
    const liteOn = storedLite ? storedLite === "on" : slow;
    setLiteState(liteOn);
    document.documentElement.dataset.lite = liteOn ? "on" : "off";
    if (slow && storedLite !== "off") toast("Low connectivity detected — Lite Mode enabled", "info");

    setOnline(navigator.onLine);
    refreshPending();

    const onOnline = () => {
      setOnline(true);
      toast("Connection restored — synchronising…", "success");
      void runSync();
    };
    const onOffline = () => {
      setOnline(false);
      toast("You're offline. Reports can still be saved on this device.", "warn");
    };
    const onStorage = () => refreshPending();

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("sautilink:storage", onStorage);

    if (navigator.onLine) void runSync();

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("sautilink:storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      lang,
      setLang,
      t: (key: TranslationKey) => translate(key, lang),
      online,
      lite,
      setLite,
      pendingCount,
      refreshPending,
      syncing,
      runSync,
      toast,
      speak,
      speaking,
    }),
    [lang, setLang, online, lite, setLite, pendingCount, refreshPending, syncing, runSync, toast, speak, speaking],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`sl-rise pointer-events-auto max-w-sm rounded-xl border px-4 py-3 text-sm shadow-lg ${
              item.tone === "success"
                ? "border-[#c6e6d5] bg-[#e6f4ec] text-[#14653f]"
                : item.tone === "warn"
                  ? "border-[#f3ddbe] bg-accent-100 text-accent-600"
                  : "border-brand-100 bg-white text-ink-900"
            }`}
          >
            {item.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

/* ------------------------------- status strip ------------------------------- */

export function ConnectivityStrip() {
  const { online, lite, setLite, pendingCount, syncing, lang, setLang, t } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
          online
            ? "border-[#c6e6d5] bg-[#e6f4ec] text-[#14653f]"
            : "border-[#f3ddbe] bg-accent-100 text-accent-600"
        }`}
      >
        <span
          aria-hidden
          className={`h-2 w-2 rounded-full ${online ? "bg-[#1a7f52]" : "bg-accent-500"}`}
        />
        {online ? t("status.online") : t("status.offline")}
      </span>
      {syncing && (
        <span className="rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 font-medium text-brand-800">
          {t("offline.syncing")}
        </span>
      )}
      {pendingCount > 0 && !syncing && (
        <Link
          href="/cases#pending"
          className="rounded-full border border-[#f3ddbe] bg-accent-100 px-2.5 py-1 font-medium text-accent-600"
        >
          {pendingCount} {t("offline.waiting").toLowerCase()}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setLite(!lite)}
        aria-pressed={lite}
        className={`rounded-full border px-2.5 py-1 font-medium transition ${
          lite
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-sand-200 bg-white text-ink-700 hover:border-brand-500"
        }`}
      >
        {t("status.lite")}: {lite ? "on" : "off"}
      </button>
      <div className="inline-flex overflow-hidden rounded-full border border-sand-200 bg-white">
        {LANGUAGES.map((option) => (
          <button
            key={option.code}
            type="button"
            onClick={() => setLang(option.code)}
            aria-pressed={lang === option.code}
            className={`px-2.5 py-1 font-medium transition ${
              lang === option.code ? "bg-brand-700 text-white" : "text-ink-700 hover:bg-sand-100"
            }`}
          >
            {option.native}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- navigation -------------------------------- */

const NAV = [
  { href: "/", key: "nav.home" as const, icon: "⌂" },
  { href: "/cases", key: "nav.cases" as const, icon: "▤" },
  { href: "/report", key: "nav.report" as const, icon: "+" },
  { href: "/assistant", key: "nav.assistant" as const, icon: "?" },
  { href: "/settings", key: "nav.settings" as const, icon: "⚙" },
];

export function CitizenNav() {
  const pathname = usePathname();
  const { t, pendingCount } = useApp();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 backdrop-blur md:static md:mx-auto md:mt-6 md:max-w-3xl md:rounded-2xl md:border"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-1 py-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const isReport = item.href === "/report";
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium transition ${
                  active ? "bg-brand-50 text-brand-800" : "text-ink-500 hover:bg-sand-100"
                }`}
              >
                <span
                  aria-hidden
                  className={`text-base leading-none ${isReport ? "rounded-full bg-brand-700 px-3 py-1.5 text-white" : "font-semibold"}`}
                >
                  {item.icon}
                </span>
                <span className="relative">
                  {t(item.key)}
                  {item.href === "/cases" && pendingCount > 0 && (
                    <span className="absolute -right-3 -top-1 rounded-full bg-accent-500 px-1 text-[9px] text-white">
                      {pendingCount}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CitizenHeader({ title, back }: { title?: string; back?: string }) {
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200 bg-sand-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {back && (
              <Link
                href={back}
                aria-label={t("common.back")}
                className="rounded-lg border border-sand-200 bg-white px-2 py-1 text-sm text-ink-700"
              >
                ←
              </Link>
            )}
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="text-base font-semibold tracking-tight text-brand-900">
                {title ?? "SautiLink"}
              </span>
            </Link>
          </div>
          <Link
            href="/transparency"
            className="rounded-lg border border-sand-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700"
          >
            Public data
          </Link>
        </div>
        <ConnectivityStrip />
      </div>
    </header>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-lg bg-brand-700"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="none">
        <path
          d="M12 3v18M7 7v10M17 7v10M3 10.5v3M21 10.5v3"
          stroke="#fff"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
