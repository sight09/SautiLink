"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/app-shell";

const DEMO_ACCOUNTS = [
  { label: "Institution — water utility", email: "water@sautilink.demo" },
  { label: "Institution — county roads", email: "roads@sautilink.demo" },
  { label: "Platform administrator", email: "admin@sautilink.demo" },
  { label: "Citizen account", email: "citizen@sautilink.demo" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error ?? "Sign-in failed.");
        return;
      }
      router.push(payload.redirect ?? "/");
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-10">
      <div className="flex items-center gap-2">
        <Logo size={34} />
        <div>
          <p className="text-lg font-semibold tracking-tight text-brand-900">SautiLink</p>
          <p className="text-xs text-ink-500">Staff sign-in</p>
        </div>
      </div>

      <form onSubmit={submit} className="sl-card space-y-3 p-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-900">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-3 text-base outline-none focus:border-brand-600"
            required
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-900">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-xl border border-sand-200 px-3 py-3 text-base outline-none focus:border-brand-600"
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-xl border border-[#f3cfcb] bg-[#fbe9e7] px-3 py-2 text-sm text-[#8c1d18]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white disabled:bg-ink-300"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="sl-card p-4 text-sm">
        <h2 className="font-semibold text-brand-900">Demonstration accounts</h2>
        <p className="mt-1 text-ink-500">Password for all demo accounts: Demo1234!</p>
        <ul className="mt-2 space-y-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email} className="flex items-center justify-between gap-2">
              <span className="text-ink-700">{account.label}</span>
              <button
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("Demo1234!");
                }}
                className="rounded-lg border border-sand-200 px-2.5 py-1 text-xs font-semibold text-brand-800"
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-sm text-ink-500">
        Citizens do not need an account.{" "}
        <Link href="/" className="font-semibold text-brand-700 underline">
          Report or track a case
        </Link>
      </p>
    </main>
  );
}
