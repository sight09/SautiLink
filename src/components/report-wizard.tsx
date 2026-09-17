"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-shell";
import { AiNotice } from "@/components/ui";
import { enqueueReport, saveCase, type QueuedEvidence } from "@/lib/offline-queue";

type Category = {
  slug: string;
  nameEn: string;
  nameSw: string;
  descriptionEn: string;
  descriptionSw: string;
  icon: string;
  sensitive: boolean;
};

type Classification = {
  categorySlug: string;
  categoryName: string;
  confidence: number;
  priority: string;
  priorityReason: string;
  summary: string;
  deEscalation: string | null;
  sensitive: boolean;
  matches: Array<{ institutionId: number; name: string; shortName: string; score: number; reasons: string[] }>;
  relatedCount: number;
};

type Submitted = {
  publicCaseId: string;
  accessCode: string;
  title: string;
  institution: { name: string; score: number } | null;
  relatedCount: number;
  priority: string;
};

const STEPS = ["Issue", "Description", "Location", "Evidence", "Privacy", "Review"];

/** Compresses a photo to a small JPEG data URL — critical for low-bandwidth uploads. */
async function compressImage(file: File, maxEdge = 900, quality = 0.55): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function ReportWizard({ categories, areas }: { categories: Category[]; areas: string[] }) {
  const { lang, online, lite, toast, refreshPending, t } = useApp();
  const [step, setStep] = useState(0);
  const [categorySlug, setCategorySlug] = useState("");
  const [description, setDescription] = useState("");
  const [areaName, setAreaName] = useState(areas[0] ?? "");
  const [locationNote, setLocationNote] = useState("");
  const [evidence, setEvidence] = useState<QueuedEvidence[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [contact, setContact] = useState("");
  const [classification, setClassification] = useState<Classification | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [queued, setQueued] = useState(false);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const selectedCategory = categories.find((c) => c.slug === categorySlug);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const runClassification = useCallback(async () => {
    if (!online) {
      setAiError("Civic AI needs a connection. You can still submit — classification runs on sync.");
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, categorySlug, areaName }),
      });
      if (!response.ok) throw new Error("unavailable");
      setClassification((await response.json()) as Classification);
    } catch {
      setClassification(null);
      setAiError("Civic AI is temporarily unavailable. You can continue manually.");
    } finally {
      setAiLoading(false);
    }
  }, [areaName, categorySlug, description, online]);

  useEffect(() => {
    if (step === 5 && !classification && !aiLoading) void runClassification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const startDictation = () => {
    type SR = new () => {
      lang: string;
      interimResults: boolean;
      continuous: boolean;
      onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Recognition) {
      toast("Voice input is not supported on this browser. Please type instead.", "warn");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = lang === "sw" ? "sw-KE" : "en-GB";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) transcript += event.results[i][0].transcript;
      setDescription((current) => `${current} ${transcript}`.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      toast("We couldn't capture that. Please try again or type your report.", "warn");
    };
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  const addPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (evidence.length >= 4) {
      toast("You can attach up to 4 evidence items.", "warn");
      return;
    }
    try {
      const dataUrl = await compressImage(file, lite ? 640 : 900, lite ? 0.42 : 0.55);
      setEvidence((current) => [
        ...current,
        {
          type: "photo",
          label: file.name.slice(0, 80) || "Photo evidence",
          storageRef: dataUrl,
          sizeBytes: Math.round((dataUrl.length * 3) / 4),
        },
      ]);
      toast("Photo compressed and attached.", "success");
    } catch {
      toast("We couldn't process this image. Your report remains saved.", "warn");
    }
  };

  const canContinue = () => {
    if (step === 0) return Boolean(categorySlug);
    if (step === 1) return description.trim().length >= 15;
    if (step === 2) return Boolean(areaName);
    if (step === 4) return anonymous || contact.trim().length > 3;
    return true;
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const payload = {
      categorySlug,
      description: description.trim(),
      areaName,
      locationNote,
      anonymous,
      reporterContact: anonymous ? "" : contact.trim(),
      language: lang,
      evidence,
    };

    if (!online) {
      enqueueReport({ ...payload, reporterContact: payload.reporterContact });
      refreshPending();
      setQueued(true);
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, channel: "web" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Submission failed");
      saveCase({
        publicCaseId: data.publicCaseId,
        accessCode: data.accessCode,
        title: data.title,
        categorySlug,
        createdAt: new Date().toISOString(),
        anonymous,
      });
      setSubmitted(data as Submitted);
    } catch (submissionError) {
      enqueueReport(payload);
      refreshPending();
      setQueued(true);
      setError(
        submissionError instanceof Error
          ? `${submissionError.message} Your report has been saved on this device and will be retried.`
          : "Submission failed. Your report has been saved on this device.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- result views ------------------------------ */

  if (queued) {
    return (
      <div className="sl-rise space-y-4">
        <div className="sl-card border-[#f3ddbe] bg-accent-100 p-5">
          <p className="font-mono text-xs font-semibold tracking-[0.18em] text-accent-600" aria-hidden>
            OFFLINE
          </p>
          <h1 className="mt-1 text-xl font-semibold text-accent-600">{t("offline.waiting")}</h1>
          <p className="mt-2 text-sm text-accent-600">{t("offline.saved")}</p>
          {error && <p className="mt-2 text-sm text-accent-600">{error}</p>}
        </div>
        <p className="text-sm text-ink-500">
          No Case ID exists yet — SautiLink only creates one once a server has genuinely received your
          report. You will see it in Pending reports until then.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/cases#pending" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">
            Go to pending reports
          </Link>
          <Link href="/" className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    const record = `SautiLink case record\nCase ID: ${submitted.publicCaseId}\nAccess code: ${submitted.accessCode}\nSummary: ${submitted.title}\nCreated: ${new Date().toISOString()}\nTrack at: /track`;
    return (
      <div className="sl-rise space-y-4">
        <div className="sl-card border-[#c6e6d5] bg-[#e6f4ec] p-5">
          <p className="text-2xl" aria-hidden>
            ✅
          </p>
          <h1 className="mt-1 text-xl font-semibold text-[#14653f]">{t("submit.success")}</h1>
          {anonymous && (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-800">
              🕶️ {t("privacy.protected")}
            </p>
          )}
        </div>

        <div className="sl-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Your case</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-brand-900">
            {submitted.publicCaseId}
          </p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Access code</p>
          <p className="font-mono text-xl font-semibold tracking-[0.2em] text-brand-900">
            {submitted.accessCode}
          </p>
          <p className="mt-3 text-sm text-ink-700">
            Save both. You need them to check your case and to reply to the institution without
            revealing your identity. We cannot recover a lost access code.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(`${submitted.publicCaseId} / ${submitted.accessCode}`);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {copied ? t("common.copied") : `${t("common.copy")} Case ID`}
            </button>
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(record)}`}
              download={`sautilink-${submitted.publicCaseId}.txt`}
              className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              Download case record
            </a>
            <Link
              href={`/case/${submitted.publicCaseId}`}
              className="rounded-xl border border-brand-600 px-4 py-2.5 text-sm font-semibold text-brand-800"
            >
              Open my case
            </Link>
          </div>
        </div>

        <div className="sl-card p-4 text-sm">
          <h2 className="font-semibold text-brand-900">What happens next</h2>
          <ul className="mt-2 space-y-1.5 text-ink-700">
            <li>
              • Routed to{" "}
              <strong>{submitted.institution ? submitted.institution.name : "manual triage"}</strong>
              {submitted.institution ? ` (match ${submitted.institution.score}%)` : ""}.
            </li>
            <li>• Urgency recorded as {submitted.priority}.</li>
            <li>
              • {submitted.relatedCount} report(s) in this area may describe a similar issue — this
              strengthens the community signal.
            </li>
            <li>• You will see every status change on your case timeline.</li>
          </ul>
        </div>
      </div>
    );
  }

  /* --------------------------------- wizard --------------------------------- */

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-sm">
          <h1 ref={headingRef} tabIndex={-1} className="text-xl font-semibold tracking-tight text-brand-900">
            {STEPS[step]}
          </h1>
          <span className="text-ink-500">
            {t("report.step")} {step + 1} {t("report.of")} {STEPS.length}
          </span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-sand-100"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label="Reporting progress"
        >
          <div
            className="h-full rounded-full bg-brand-600 transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {step === 0 && (
        <fieldset className="sl-rise">
          <legend className="mb-2 text-sm text-ink-500">What is the issue about?</legend>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.map((category) => {
              const active = category.slug === categorySlug;
              return (
                <li key={category.slug}>
                  <button
                    type="button"
                    onClick={() => setCategorySlug(category.slug)}
                    aria-pressed={active}
                    className={`flex min-h-[72px] w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active ? "border-brand-600 bg-brand-50" : "border-sand-200 bg-white hover:border-brand-500"
                    }`}
                  >
                    <span aria-hidden className="text-xl">
                      {category.icon}
                    </span>
                    <span>
                      <span className="block font-semibold text-ink-900">
                        {lang === "sw" ? category.nameSw : category.nameEn}
                      </span>
                      <span className="block text-xs text-ink-500">
                        {lang === "sw" ? category.descriptionSw : category.descriptionEn}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedCategory?.sensitive && (
            <p className="mt-3 rounded-xl border border-[#f3ddbe] bg-accent-100 px-3 py-2 text-sm text-accent-600">
              This category is handled with extra privacy safeguards: it is never shown on public
              dashboards and only trained staff can open it. If you are in immediate danger, contact
              local emergency services first.
            </p>
          )}
        </fieldset>
      )}

      {step === 1 && (
        <div className="sl-rise space-y-3">
          <label htmlFor="description" className="block text-sm font-medium text-ink-900">
            Describe what is happening
          </label>
          <p className="text-sm text-ink-500">
            Helpful details: what stopped working, when it started, how many people are affected.
          </p>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={7}
            maxLength={4000}
            placeholder="There has been no water in our neighbourhood for two weeks…"
            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-base leading-relaxed outline-none focus:border-brand-600"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={startDictation}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${
                listening ? "border-brand-600 bg-brand-50 text-brand-800" : "border-sand-200 bg-white text-ink-700"
              }`}
            >
              <span aria-hidden>🎙️</span>
              {listening ? "Listening…" : "Speak instead of typing"}
            </button>
            <span className={`text-xs ${description.trim().length < 15 ? "text-accent-600" : "text-ink-500"}`}>
              {description.trim().length < 15
                ? `${15 - description.trim().length} more characters needed`
                : `${description.length}/4000`}
            </span>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="sl-rise space-y-3">
          <label htmlFor="area" className="block text-sm font-medium text-ink-900">
            Which area is affected?
          </label>
          <select
            id="area"
            value={areaName}
            onChange={(event) => setAreaName(event.target.value)}
            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-600"
          >
            {areas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
          <label htmlFor="locationNote" className="block text-sm font-medium text-ink-900">
            Nearest landmark (optional)
          </label>
          <input
            id="locationNote"
            value={locationNote}
            onChange={(event) => setLocationNote(event.target.value)}
            maxLength={240}
            placeholder="Near the northern entrance, opposite the school"
            className="w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-600"
          />
          <p className="rounded-xl border border-sand-200 bg-sand-100 px-3 py-2 text-sm text-ink-700">
            SautiLink records an <strong>approximate area</strong>, never your GPS position. Exact
            locations are not published.
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="sl-rise space-y-3">
          <p className="text-sm text-ink-500">
            Evidence is optional but strengthens the case. Photos are compressed on your device before
            upload{lite ? " (Lite Mode: extra compression)" : ""}. Never put yourself at risk to
            collect evidence.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-brand-600 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-800"
            >
              📷 Add photo
            </button>
            <button
              type="button"
              onClick={() => {
                const label = window.prompt("Describe the evidence (e.g. receipt number, notice date)");
                if (label && label.trim()) {
                  setEvidence((current) => [
                    ...current,
                    { type: "note", label: label.trim().slice(0, 120), storageRef: "", sizeBytes: 0 },
                  ]);
                }
              }}
              className="rounded-xl border border-sand-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700"
            >
              📝 Add written evidence
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                void addPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </div>
          {evidence.length === 0 ? (
            <p className="rounded-xl border border-dashed border-sand-200 px-4 py-6 text-center text-sm text-ink-500">
              No evidence attached yet. You can submit without it.
            </p>
          ) : (
            <ul className="space-y-2">
              {evidence.map((item, index) => (
                <li key={`${item.label}-${index}`} className="sl-card flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-sm text-ink-900">
                    {item.type === "photo" ? "📷" : "📝"} {item.label}
                    {item.sizeBytes > 0 && (
                      <span className="ml-2 text-xs text-ink-500">{Math.round(item.sizeBytes / 1024)} KB</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEvidence((current) => current.filter((_, i) => i !== index))}
                    className="rounded-lg border border-sand-200 px-2 py-1 text-xs font-medium text-ink-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="sl-rise space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setAnonymous(true)}
              aria-pressed={anonymous}
              className={`rounded-xl border px-4 py-4 text-left ${
                anonymous ? "border-brand-600 bg-brand-50" : "border-sand-200 bg-white"
              }`}
            >
              <span className="block font-semibold text-brand-900">🕶️ Report anonymously</span>
              <span className="mt-1 block text-sm text-ink-500">
                No name, phone or email is collected. You follow up with your Case ID and access code.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAnonymous(false)}
              aria-pressed={!anonymous}
              className={`rounded-xl border px-4 py-4 text-left ${
                !anonymous ? "border-brand-600 bg-brand-50" : "border-sand-200 bg-white"
              }`}
            >
              <span className="block font-semibold text-brand-900">🪪 Report with a contact</span>
              <span className="mt-1 block text-sm text-ink-500">
                Add one contact detail so the institution can reach you directly.
              </span>
            </button>
          </div>

          {!anonymous && (
            <div>
              <label htmlFor="contact" className="block text-sm font-medium text-ink-900">
                Phone or email
              </label>
              <input
                id="contact"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="mt-1 w-full rounded-xl border border-sand-200 bg-white px-3 py-3 text-base outline-none focus:border-brand-600"
                placeholder="+254… or you@example.com"
              />
            </div>
          )}

          <div className="sl-card p-4 text-sm">
            <h2 className="font-semibold text-brand-900">What each option means</h2>
            <ul className="mt-2 space-y-1.5 text-ink-700">
              <li>
                • <strong>Anonymous:</strong> case content is stored without any link to an account.
                Institution staff see “Anonymous reporter” only. Two-way messaging still works.
              </li>
              <li>
                • <strong>With contact:</strong> your contact detail is stored with the case and is
                visible to the handling institution so they can call or email you.
              </li>
              <li>
                • Either way, your report is never published with personal details on the public
                dashboard, and sensitive categories are excluded from public aggregates entirely.
              </li>
              <li>
                • Honest limitation: network metadata (such as your IP address) may be seen by the
                hosting provider. SautiLink does not store it against your case.
              </li>
            </ul>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="sl-rise space-y-3">
          <div className="sl-card p-4 text-sm">
            <h2 className="font-semibold text-brand-900">Your report</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-ink-500">Category</dt>
                <dd className="text-ink-900">
                  {selectedCategory ? (lang === "sw" ? selectedCategory.nameSw : selectedCategory.nameEn) : "—"}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-ink-500">Area</dt>
                <dd className="text-ink-900">{areaName}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-ink-500">Evidence</dt>
                <dd className="text-ink-900">{evidence.length} item(s)</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-ink-500">Identity</dt>
                <dd className="text-ink-900">{anonymous ? "Anonymous" : `Contact: ${contact}`}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-ink-500">Description</dt>
                <dd className="text-ink-900">{description}</dd>
              </div>
            </dl>
          </div>

          {aiLoading && <div className="sl-skeleton h-24 rounded-xl" aria-label="Analysing report" />}

          {aiError && !aiLoading && (
            <p className="rounded-xl border border-[#f3ddbe] bg-accent-100 px-3 py-2 text-sm text-accent-600">
              {aiError}{" "}
              <button type="button" onClick={() => void runClassification()} className="font-semibold underline">
                Retry
              </button>
            </p>
          )}

          {classification && !aiLoading && (
            <div className="sl-card space-y-2 p-4 text-sm">
              <h2 className="font-semibold text-brand-900">AI-assisted review</h2>
              <p className="text-ink-700">
                Suggested category: <strong>{classification.categoryName}</strong> (
                {classification.confidence}% confidence)
              </p>
              <p className="text-ink-700">
                Suggested urgency: <strong className="capitalize">{classification.priority}</strong> —{" "}
                {classification.priorityReason}
              </p>
              {classification.matches[0] && (
                <p className="text-ink-700">
                  Possible institution match: <strong>{classification.matches[0].score}%</strong> —{" "}
                  {classification.matches[0].name}
                  {classification.matches[0].reasons.length > 0 && (
                    <span className="text-ink-500"> ({classification.matches[0].reasons.join("; ")})</span>
                  )}
                </p>
              )}
              {classification.relatedCount > 0 && (
                <p className="text-ink-700">
                  <strong>{classification.relatedCount}</strong> report(s) may describe a similar issue
                  in {areaName}. Your report will not be merged automatically.
                </p>
              )}
              <AiNotice>
                This is an AI-assisted recommendation based on available information. Staff review every
                case; nothing here is treated as proof.
              </AiNotice>
              {classification.deEscalation && (
                <p className="rounded-xl border border-[#f3ddbe] bg-accent-100 px-3 py-2 text-ink-900">
                  🕊️ {classification.deEscalation}
                </p>
              )}
            </div>
          )}

          {!online && (
            <p className="rounded-xl border border-[#f3ddbe] bg-accent-100 px-3 py-2 text-sm text-accent-600">
              📡 You are offline. Submitting will save this report securely on this device and send it
              automatically when a connection returns.
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-[#f3cfcb] bg-[#fbe9e7] px-3 py-2 text-sm text-[#8c1d18]">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={() => (step === 0 ? window.history.back() : setStep((s) => s - 1))}
          className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700"
        >
          {t("common.back")}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canContinue()}
            onClick={() => setStep((s) => s + 1)}
            className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {t("common.next")}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white disabled:bg-ink-300"
          >
            {submitting ? "Submitting…" : online ? t("common.submit") : "Save report on this device"}
          </button>
        )}
      </div>
    </div>
  );
}
