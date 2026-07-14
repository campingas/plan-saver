import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-6 pt-8">
        <div className="flex items-stretch border border-line-strong bg-panel">
          <Link
            href="/"
            className="display px-5 py-2.5 text-[26px] text-ink hover:text-accent transition-colors"
          >
            Plan-Saver
          </Link>
          <div className="eyebrow hidden items-center border-l border-line px-4 md:flex">
            Controlled archive for agents
          </div>
          <nav className="ml-auto flex items-stretch">
            <Link href="/settings/tokens" className="nav-cell">
              API tokens
            </Link>
            <span
              tabIndex={0}
              className="email-veil nav-cell hidden !text-muted sm:flex"
              style={{ textTransform: "none", letterSpacing: 0 }}
            >
              {session.user.email}
            </span>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="reveal mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
