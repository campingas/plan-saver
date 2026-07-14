"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: "/" });
    if (error) {
      setStatus("error");
      setError(error.message ?? "Could not send the sign-in link.");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Plan-Saver</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Sign in with a magic link to access your archive.
          </p>
        </div>
        {status === "sent" ? (
          <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Check your inbox — a sign-in link is on its way to {email}.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
