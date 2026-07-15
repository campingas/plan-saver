"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
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
      setError(error.message ?? "The sign-in link could not be sent. Try again.");
    } else {
      setStatus("sent");
    }
  }

  if (status === "sent") {
    return (
      <div className="border border-accent bg-panel p-4" role="status">
        <p className="eyebrow mb-1 !text-accent">Check your inbox</p>
        <p className="text-sm text-muted">
          If this address is registered, a sign-in link will arrive shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="eyebrow block" htmlFor="email">
        Registered email
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="field"
      />
      <button type="submit" disabled={status === "sending"} className="btn btn-primary w-full">
        {status === "sending" ? "Sending…" : "Send sign-in link"}
      </button>
      {error && <p className="text-sm text-stamp" role="alert">{error}</p>}
    </form>
  );
}
