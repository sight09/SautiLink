"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCase } from "@/lib/offline-queue";
import { useApp } from "@/components/app-shell";

export default function TrackPage() {
  const router = useRouter();
  const { online, toast } = useApp();
  const [caseId, setCaseId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const id = caseId.trim().toUpperCase();
    const accessCode = code.trim().toUpperCase();
    if (!/^CS-[A-Z0-9]{3,6}-[A-Z0-9]{2,4}$/.test(id)) {
      setError("Case IDs look like CS-82A91-K7X. Check your saved case record and try again.");
      return;
    }
    if (!online) {
      setError("You're offline. Checking a case needs a connection — your report stays saved meanwhile.");
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(
        `/api/cases/${encodeURIComponent(id)}?code=${encodeURIComponent(accessCode)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "We couldn't find that case. Check your Case ID and try again.");
        return;
      }
      saveCase({
        publicCaseId: payload.case.publicCaseId,
        accessCode,
        title: payload.case.title,
        categorySlug: payload.case.categorySlug,
        createdAt: payload.case.createdAt,
        anonymous: payload.case.anonymous,
      });
      toast("Case found.", "success");
      router.push(`/case/${payload.case.publicCaseId}`);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-brand-900">Check my case</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter the Case ID and access code from your case record. No account is needed — this is how
          anonymous reporters follow up safely.
        </p>
      </header>

      <form onSubmit={submit} className="sl-card space-y-3 p-5">
        <div>
          <label htmlFor="caseId" className="block text-sm font-medium text-ink-900">
            Case ID
          </label>
          <input
            id="caseId"
            value={caseId}
            onChange={(event) => setCaseId(event.target.value.toUpperCase())}
            placeholder="CS-82A91-K7X"
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 font-mono text-base outline-none focus:border-brand-600"
          />
        </div>
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-ink-900">
            Access code
          </label>
          <input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="SAUTI1"
            autoComplete="off"
            className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 font-mono tracking-[0.2em] text-base outline-none focus:border-brand-600"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-[#f3cfcb] bg-[#fbe9e7] px-3 py-2 text-sm text-[#8c1d18]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          {checking ? "Checking…" : "Open my case"}
        </button>
      </form>

      <div className="sl-card p-4 text-sm text-ink-700">
        <h2 className="font-semibold text-brand-900">Demonstration case</h2>
        <p className="mt-1">
          For the pilot demo you can open case <span className="font-mono">CS-82A91-K7X</span> with
          access code <span className="font-mono tracking-[0.2em]">SAUTI1</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setCaseId("CS-82A91-K7X");
            setCode("SAUTI1");
          }}
          className="mt-2 rounded-lg border border-sand-200 px-3 py-1.5 text-xs font-semibold text-ink-700"
        >
          Fill demo credentials
        </button>
      </div>
    </div>
  );
}
