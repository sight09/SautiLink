import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <span aria-hidden className="text-4xl">
        📡
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-900">You&apos;re offline</h1>
      <p className="text-sm leading-relaxed text-ink-700">
        SautiLink still works. You can write a report now — it will be stored securely on this device
        and submitted automatically when a connection returns. No Case ID is created until a server
        has genuinely received your report.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/report" className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white">
          Create a report offline
        </Link>
        <Link
          href="/cases"
          className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700"
        >
          Pending reports
        </Link>
      </div>
    </main>
  );
}
