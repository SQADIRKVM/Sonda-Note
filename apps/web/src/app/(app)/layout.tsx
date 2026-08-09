"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthBridge } from "@/components/auth-bridge";
import { Nav } from "@/components/nav";
import { Spinner } from "@/components/ui";
import { getSession, type Session } from "@/lib/auth";

/**
 * Shell for every signed-in page.
 *
 * A client component because the session lives in localStorage, which a server
 * component cannot read. Middleware already redirected anyone without a session
 * cookie; this re-checks so a cleared localStorage cannot leave the UI in a
 * half-authenticated state.
 */
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
      <div className="flex min-h-screen items-center justify-center text-smoke">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <AuthBridge session={session} />
      <Nav email={session.user.email} workspaceName={session.workspace.name} />
      <main className="mx-auto max-w-[1180px] px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-[1180px] border-t border-white/10 px-6 py-8">
        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          Sonda Note · v1.0
        </p>
      </footer>
    </>
  );
}
