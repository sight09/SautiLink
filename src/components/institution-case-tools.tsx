"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CASE_STATUSES, STATUS_LABEL } from "@/lib/i18n";

type Props = {
  publicCaseId: string;
  status: string;
  priority: string;
  assignedTo: string;
};

const QUICK_ACTIONS: Array<{ key: string; label: string; status: string; message: string; note: string }> = [
  {
    key: "acknowledge",
    label: "Acknowledge",
    status: "under_review",
    message: "We have received this report and it is now under review by our case desk.",
    note: "Case acknowledged and moved to review.",
  },
  {
    key: "request-info",
    label: "Request information",
    status: "info_needed",
    message:
      "We need a more precise description of the location. Which tap or line is affected, and is the whole lane affected or only some households?",
    note: "Additional information requested from the reporter.",
  },
  {
    key: "respond",
    label: "Send official response",
    status: "responded",
    message:
      "Thank you for the additional detail. A crew has been scheduled and we will update this case once work begins.",
    note: "Official response issued to the reporter.",
  },
  {
    key: "in-progress",
    label: "Mark work in progress",
    status: "in_progress",
    message: "Work on this issue has now started on site.",
    note: "Field work started.",
  },
  {
    key: "resolve",
    label: "Resolve case",
    status: "resolved",
    message:
      "Supply has been restored and tested on site. Please reopen a new report if the problem returns.",
    note: "Issue resolved and verified on site.",
  },
];

export function InstitutionCaseTools({ publicCaseId, status, priority, assignedTo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState("");
  const [assignee, setAssignee] = useState(assignedTo);
  const [nextStatus, setNextStatus] = useState(status);
  const [nextPriority, setNextPriority] = useState(priority);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const post = async (payload: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    setFeedback(null);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(publicCaseId)}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Update failed");
      setFeedback({ tone: "ok", text: "Case updated. The reporter has been notified in their case." });
      setMessage("");
      setNote("");
      setInternal("");
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: "error",
        text: error instanceof Error ? error.message : "We couldn't update this case.",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Quick actions</h2>
        <p className="mt-1 text-xs text-ink-500">
          Each action writes a timestamped timeline entry and, where relevant, an anonymous message to
          the reporter. Prepared wording can be edited before sending below.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.key}
              type="button"
              disabled={busy !== null}
              onClick={() =>
                void post(
                  { status: action.status, note: action.note, messageToReporter: action.message },
                  action.key,
                )
              }
              className="rounded-xl border border-brand-600 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 disabled:opacity-50"
            >
              {busy === action.key ? "Working…" : action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Message the anonymous reporter</h2>
        <label htmlFor="msg" className="sr-only">
          Message to reporter
        </label>
        <textarea
          id="msg"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ask a question or share an update…"
          className="mt-2 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <button
          type="button"
          disabled={busy !== null || message.trim().length < 2}
          onClick={() => void post({ messageToReporter: message.trim() }, "message")}
          className="mt-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          {busy === "message" ? "Sending…" : "Send message"}
        </button>
      </section>

      <section className="sl-card p-4">
        <h2 className="text-sm font-semibold text-brand-900">Update case</h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="status" className="block text-xs font-medium text-ink-700">
              Status
            </label>
            <select
              id="status"
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600"
            >
              {CASE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value].en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="block text-xs font-medium text-ink-700">
              Priority
            </label>
            <select
              id="priority"
              value={nextPriority}
              onChange={(event) => setNextPriority(event.target.value)}
              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600"
            >
              {["low", "medium", "high", "critical"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="assignee" className="block text-xs font-medium text-ink-700">
              Assign to team
            </label>
            <input
              id="assignee"
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="e.g. Distribution Team B"
              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="note" className="block text-xs font-medium text-ink-700">
              Timeline note (visible to reporter)
            </label>
            <textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="internal" className="block text-xs font-medium text-ink-700">
              Internal note (staff only)
            </label>
            <textarea
              id="internal"
              value={internal}
              onChange={(event) => setInternal(event.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
          </div>
        </div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            void post(
              {
                status: nextStatus,
                priority: nextPriority,
                assignedTo: assignee,
                note: note.trim(),
                internalNote: internal.trim() || undefined,
              },
              "update",
            )
          }
          className="mt-3 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          {busy === "update" ? "Saving…" : "Save update"}
        </button>
      </section>

      {feedback && (
        <p
          role="status"
          className={`rounded-xl border px-3 py-2 text-sm ${
            feedback.tone === "ok"
              ? "border-[#c6e6d5] bg-[#e6f4ec] text-[#14653f]"
              : "border-[#f3cfcb] bg-[#fbe9e7] text-[#8c1d18]"
          }`}
        >
          {feedback.text}
        </p>
      )}
    </div>
  );
}
