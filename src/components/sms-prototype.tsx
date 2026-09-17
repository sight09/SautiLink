"use client";

import Link from "next/link";
import { useState } from "react";
import { saveCase } from "@/lib/offline-queue";

type Result = { publicCaseId: string; accessCode: string; reply: string; areaName: string };

export function SmsPrototype() {
  const [body, setBody] = useState("MAJI Kibera hakuna maji kwa wiki mbili karibu na lango la kaskazini");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/sms/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "+254700123456", body }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Prototype failed");
      setResult(payload as Result);
      saveCase({
        publicCaseId: payload.publicCaseId,
        accessCode: payload.accessCode,
        title: "Case created via SMS fallback prototype",
        categorySlug: payload.categorySlug,
        createdAt: new Date().toISOString(),
        anonymous: true,
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Prototype failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-labelledby="sms-heading" className="sl-card p-4">
      <div className="flex items-center gap-2">
        <h2 id="sms-heading" className="text-lg font-semibold tracking-tight text-brand-900">
          SMS fallback
        </h2>
        <span className="rounded-full border border-[#f3ddbe] bg-accent-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-600">
          Prototype
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-500">
        For people with cellular service but no data. <strong>No real SMS is sent here.</strong> This
        simulates the gateway webhook so the production integration is a configuration change, not a
        rewrite. Format: <span className="font-mono">KEYWORD AREA description</span>.
      </p>
      <label htmlFor="sms" className="mt-3 block text-sm font-medium text-ink-900">
        Simulated message
      </label>
      <textarea
        id="sms"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={320}
        className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-brand-600"
      />
      <button
        type="button"
        onClick={() => void send()}
        disabled={sending}
        className="mt-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-ink-300"
      >
        {sending ? "Processing…" : "Send simulated SMS"}
      </button>
      {error && (
        <p role="alert" className="mt-2 rounded-xl border border-[#f3cfcb] bg-[#fbe9e7] px-3 py-2 text-sm text-[#8c1d18]">
          {error}
        </p>
      )}
      {result && (
        <div className="mt-3 rounded-xl border border-sand-200 bg-sand-100 px-3 py-2 text-sm">
          <p className="font-mono text-xs text-ink-700">{result.reply}</p>
          <Link
            href={`/case/${result.publicCaseId}`}
            className="mt-2 inline-block rounded-lg border border-brand-600 px-3 py-1.5 text-xs font-semibold text-brand-800"
          >
            Open the case created from this SMS
          </Link>
        </div>
      )}
    </section>
  );
}
