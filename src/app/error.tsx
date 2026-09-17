"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Privacy-aware logging: message only, never user content.
    console.error("sautilink.ui.error", error.message);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6">
      <span aria-hidden className="text-4xl">
        ⚠️
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-brand-900">Something went wrong</h1>
      <p className="text-sm text-ink-700">
        This screen could not load. Nothing you have saved on this device has been lost — drafts and
        saved cases remain available.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-sand-200 bg-white px-4 py-3 text-sm font-semibold text-ink-700"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
