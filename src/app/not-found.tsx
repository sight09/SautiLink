import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <span aria-hidden className="text-4xl">
        🧭
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Page not found</h1>
      <p className="text-sm text-ink-700">
        We couldn&apos;t find that page. If you were looking for a case, use your Case ID and access
        code to open it safely.
      </p>
      <div className="flex justify-center gap-2">
        <Link href="/" className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white">
          Go home
        </Link>
        <Link
          href="/track"
          className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700"
        >
          Check a case
        </Link>
      </div>
    </main>
  );
}
