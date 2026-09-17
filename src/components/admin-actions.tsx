"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Payload = Record<string, unknown> & { action: string };

function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (payload: Payload) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Action failed");
      router.refresh();
      return true;
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { run, busy, error };
}

export function AdminToggle({
  action,
  id,
  label,
  danger,
}: {
  action: string;
  id: number;
  label: string;
  danger?: boolean;
}) {
  const { run, busy, error } = useAdminAction();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ action, id })}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
          danger ? "border-[#f3cfcb] text-[#8c1d18]" : "border-sand-200 text-ink-700"
        }`}
      >
        {busy ? "Working…" : label}
      </button>
      {error && <span className="mt-1 text-[11px] text-[#8c1d18]">{error}</span>}
    </span>
  );
}

export function ModerationButtons({ publicCaseId }: { publicCaseId: string }) {
  const { run, busy, error } = useAdminAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ action: "case.moderate", publicCaseId, decision: "keep" })}
        className="rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-semibold text-ink-700 disabled:opacity-50"
      >
        Keep open
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run({ action: "case.moderate", publicCaseId, decision: "close" })}
        className="rounded-lg border border-[#f3cfcb] px-3 py-1.5 text-xs font-semibold text-[#8c1d18] disabled:opacity-50"
      >
        Close case
      </button>
      {error && <span className="text-[11px] text-[#8c1d18]">{error}</span>}
    </div>
  );
}

export function CategoryCreateForm() {
  const { run, busy, error } = useAdminAction();
  const [form, setForm] = useState({ slug: "", nameEn: "", nameSw: "", icon: "📌", keywords: "" });

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await run({ action: "category.create", ...form });
        if (ok) setForm({ slug: "", nameEn: "", nameSw: "", icon: "📌", keywords: "" });
      }}
    >
      {(
        [
          ["slug", "Slug (e.g. street-lighting)"],
          ["nameEn", "Name (English)"],
          ["nameSw", "Name (Swahili)"],
          ["icon", "Icon"],
        ] as const
      ).map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`cat-${key}`} className="block text-xs font-medium text-ink-700">
            {label}
          </label>
          <input
            id={`cat-${key}`}
            value={form[key]}
            onChange={(event) => setForm({ ...form, [key]: event.target.value })}
            required={key !== "icon"}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </div>
      ))}
      <div className="sm:col-span-2">
        <label htmlFor="cat-keywords" className="block text-xs font-medium text-ink-700">
          Classification keywords (comma separated)
        </label>
        <input
          id="cat-keywords"
          value={form.keywords}
          onChange={(event) => setForm({ ...form, keywords: event.target.value })}
          placeholder="streetlight, lamp, taa"
          className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
      </div>
      {error && <p className="sm:col-span-2 text-xs text-[#8c1d18]">{error}</p>}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          {busy ? "Saving…" : "Add category"}
        </button>
      </div>
    </form>
  );
}
