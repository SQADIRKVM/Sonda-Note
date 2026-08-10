"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthBridge } from "@/components/auth-bridge";
import { Nav } from "@/components/nav";
import { Spinner } from "@/components/ui";
import { getSession, type Session } from "@/lib/auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/login");
      return;
    }
    setSession(current);
    setChecked(true);
  }, [router]);

  if (!checked || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sn-canvas text-sn-ink-tertiary">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-sn-canvas text-sn-ink font-sans selection:bg-sn-accent-tint selection:text-sn-ink">
      <div className="flex-1">
        <AuthBridge session={session} />
        <Nav email={session.user.email} workspaceName={session.workspace.name} />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10 py-10 sm:py-12">{children}</main>
      </div>

      <footer className="w-full border-t border-sn-hairline bg-transparent py-8 text-sn-ink-secondary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans">
          <p className="font-serif text-sm font-normal text-sn-ink">
            Sonda<span className="text-sn-accent">.</span>
          </p>
          <p>Meeting notes for teams who don't speak one language at a time. Built in Kerala.</p>
          <p className="font-mono text-[11px] text-sn-ink-tertiary">Sonda Note · v1.0</p>
        </div>
      </footer>
    </div>
  );
}
