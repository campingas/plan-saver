"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

function LoginCard() {
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

  return (
    <div className="relative w-full max-w-sm">
      <Image
        src="/mascot-cut.png"
        alt="The campingas mascot popping out of the sign-in box"
        width={180}
        height={243}
        className="absolute -top-[150px] right-5 z-0 -rotate-2"
        priority
      />
      <div className="plate relative z-10 w-full p-8">
      <p className="eyebrow mb-1.5">Sign in</p>
      <h2 className="display mb-6 text-[30px]">Your archive</h2>
      {status === "sent" ? (
        <div className="border border-accent bg-panel p-4">
          <p className="eyebrow mb-1 !text-accent">Link sent</p>
          <p className="text-sm text-muted">Check {email} for a sign-in link. It expires shortly.</p>
        </div>
      ) : (
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
          {error && <p className="text-sm text-stamp">{error}</p>}
        </form>
      )}
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70">
          Access restricted to listed emails
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col lg:flex-row-reverse">
      {/* login: sticky right rail on desktop, first on mobile */}
      <aside className="flex items-center justify-center border-b border-line px-6 py-14 lg:sticky lg:top-0 lg:h-screen lg:w-[35%] lg:border-b-0 lg:border-l lg:py-0">
        <LoginCard />
      </aside>

      {/* showcase: left 65%, scrolls with the page */}
      <section className="reveal w-full px-6 py-14 lg:w-[65%] lg:px-14">
        <div className="mx-auto max-w-2xl space-y-14">
          <div>
            <div className="mb-6">
              <p className="eyebrow mb-1.5">Controlled archive for agents</p>
              <h1 className="display text-[44px]">Plan-Saver</h1>
            </div>
            <p className="text-lg text-muted">
              Every plan and report your coding agent writes, filed automatically: by project, by
              document, by revision.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="eyebrow">What it does</h2>
            <p className="text-sm leading-relaxed text-ink">
              The <code className="font-mono text-accent">html-planning</code>{" "}
              skill turns Claude Code&apos;s implementation plans and reports into self-contained
              HTML documents. The moment one is written, the skill posts it here with a personal
              API token. No manual filing: the project comes from the repo, the document from the
              title, and re-generating the same plan chains a new revision: v1, v2, v3.
            </p>
            <p className="text-sm leading-relaxed text-ink">
              Documents render in a sandboxed viewer that keeps their scripts away from your
              session, and any revision can be handed out with a revocable secret link.
            </p>
          </div>

          <div className="border border-line-strong bg-panel">
            <h2 className="eyebrow border-b border-line-strong px-5 py-2.5">How it works</h2>
            {[
              ["01", "Generate", "The agent plans or reports; the skill renders it as one HTML file."],
              ["02", "Archive", "The file is posted with your token and filed under project / document / revision."],
              ["03", "Read & share", "Browse the register, compare revisions, issue share links."],
            ].map(([n, lead, text]) => (
              <div
                key={n}
                className="grid grid-cols-[auto_auto_1fr] items-baseline gap-x-5 border-b border-line px-5 py-3.5 last:border-b-0"
              >
                <span className="font-mono text-sm text-accent">{n}</span>
                <span className="font-medium text-ink">{lead}</span>
                <span className="text-sm text-muted">{text}</span>
              </div>
            ))}
          </div>

          <div className="space-y-8">
            <h2 className="eyebrow">What a filed document looks like</h2>
            <figure className="space-y-2">
              <figcaption className="flex items-center gap-3">
                <span className="stamp text-accent">plan</span>
                <span className="font-mono text-xs text-muted">rev v1 · demo</span>
              </figcaption>
              <div className="plate">
                <iframe
                  sandbox=""
                  src="/examples/plan-example.html"
                  title="Example plan document"
                  className="block h-[420px] w-full"
                />
              </div>
            </figure>
            <figure className="space-y-2">
              <figcaption className="flex items-center gap-3">
                <span className="stamp text-gold">report</span>
                <span className="font-mono text-xs text-muted">rev v1 · demo</span>
              </figcaption>
              <div className="plate">
                <iframe
                  sandbox=""
                  src="/examples/report-example.html"
                  title="Example report document"
                  className="block h-[420px] w-full"
                />
              </div>
            </figure>
          </div>

          <p className="border-t border-line pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted/70">
            Plan-Saver · private by default · share by exception
          </p>
        </div>
      </section>
    </main>
  );
}
