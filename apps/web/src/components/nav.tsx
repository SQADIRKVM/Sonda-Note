"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";

const LINKS = [
  { href: "/meetings", label: "Meetings" },
  { href: "/tasks", label: "Tasks" },
  { href: "/vocabulary", label: "Vocabulary" },
];

export function Nav({
  email,
  workspaceName,
}: {
  email: string | null;
  workspaceName: string | null;
}) {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-sn-hairline bg-sn-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 md:px-10 h-16">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/meetings" className="flex items-center gap-1.5 select-none hover:opacity-90 transition-opacity">
            <span className="font-serif text-xl font-normal text-sn-ink">
              Sonda<span className="text-sn-accent">.</span>
            </span>
          </Link>

          {/* Navigation Items (Granola Capsule Pill Styles) */}
          <div className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-all select-none",
                    active
                      ? "bg-[#191A14] text-[#FFFDF8] shadow-sm"
                      : "text-sn-ink-secondary hover:text-sn-ink hover:bg-black/5"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Pane Profile & Sign Out */}
        <div className="flex items-center gap-5">
          {workspaceName && (
            <span className="hidden font-mono text-[11px] text-sn-ink-tertiary uppercase tracking-wider font-medium sm:inline">
              Workspace: {workspaceName}
            </span>
          )}
          <button
            onClick={signOut}
            title={email ?? undefined}
            className="flex items-center gap-1.5 font-sans text-xs font-medium text-sn-ink-secondary transition-all hover:text-sn-alert"
          >
            <span>Sign out</span>
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
