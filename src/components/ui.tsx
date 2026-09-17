import Link from "next/link";
import type { ReactNode } from "react";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TRUST_EXPLAINER,
  TRUST_LABEL,
  formatDateTime,
  type CaseStatus,
  type Lang,
  type TrustLevel,
} from "@/lib/i18n";

export function StatusPill({ status, lang = "en" }: { status: string; lang?: Lang }) {
  const key = (status in STATUS_LABEL ? status : "submitted") as CaseStatus;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[key]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[key][lang]}
    </span>
  );
}

export function PriorityPill({ priority, lang = "en" }: { priority: string; lang?: Lang }) {
  const tone = PRIORITY_TONE[priority] ?? PRIORITY_TONE.medium;
  const label = PRIORITY_LABEL[priority]?.[lang] ?? priority;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function TrustBadge({ level, lang = "en" }: { level: string; lang?: Lang }) {
  const key = (level in TRUST_LABEL ? level : "community_reported") as TrustLevel;
  const marker: Record<TrustLevel, string> = {
    community_reported: "01",
    evidence_submitted: "02",
    community_corroborated: "03",
    institution_responded: "04",
    verified: "05",
  };
  return (
    <span
      title={TRUST_EXPLAINER[key][lang]}
      className="inline-flex items-center gap-1.5 rounded-full border border-sand-200 bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink-700"
    >
      <span aria-hidden className="font-mono text-[10px] text-brand-700">{marker[key]}</span>
      {TRUST_LABEL[key][lang]}
    </span>
  );
}

export function SectionTitle({
  title,
  action,
  description,
}: {
  title: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon = "—",
  title,
  body,
  cta,
}: {
  icon?: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="sl-card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span aria-hidden className="text-2xl font-semibold text-brand-600">
        {icon}
      </span>
      <h3 className="text-base font-semibold text-brand-900">{title}</h3>
      <p className="max-w-sm text-sm text-ink-500">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

export function AiNotice({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-[#cfe1f4] bg-[#eaf2fb] px-3 py-2 text-xs leading-relaxed text-[#12507f]">
      <span aria-hidden className="mt-0.5 font-mono text-[10px] font-semibold">AI</span>
      <span>{children}</span>
    </p>
  );
}

export type TimelineEntry = {
  status: string;
  actorLabel: string;
  note: string;
  createdAt: string | Date;
};

export function Timeline({ entries, lang = "en" }: { entries: TimelineEntry[]; lang?: Lang }) {
  return (
    <ol className="relative ml-2 border-l-2 border-sand-200 pl-5">
      {entries.map((entry, index) => {
        const last = index === entries.length - 1;
        const key = (entry.status in STATUS_LABEL ? entry.status : "submitted") as CaseStatus;
        return (
          <li key={`${entry.status}-${index}`} className="relative pb-5 last:pb-0">
            <span
              aria-hidden
              className={`absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                last ? "sl-pulse border-brand-600 bg-brand-600" : "border-brand-500 bg-white"
              }`}
            />
            <p className="text-sm font-semibold text-brand-900">{STATUS_LABEL[key][lang]}</p>
            {entry.note && <p className="mt-0.5 text-sm text-ink-700">{entry.note}</p>}
            <p className="mt-0.5 text-xs text-ink-500">
              {entry.actorLabel} · {formatDateTime(entry.createdAt, lang)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warn" | "ok" | "danger";
}) {
  const tones: Record<string, string> = {
    default: "text-brand-900",
    warn: "text-accent-600",
    ok: "text-[#14653f]",
    danger: "text-[#8c1d18]",
  };
  return (
    <div className="sl-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

export function BarRow({
  label,
  value,
  max,
  tone = "bg-brand-600",
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink-900">{label}</span>
        <span className="tabular-nums text-ink-700">{value}</span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-sand-100"
        role="img"
        aria-label={`${label}: ${value}`}
      >
        <div className={`h-full rounded-full ${tone} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
