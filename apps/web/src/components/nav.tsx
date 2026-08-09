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
    <nav className="sticky top-0 z-40 border-b border-white/10 bg-[#070709]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href="/meetings" className="flex items-center gap-2 select-none hover:opacity-90 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#FF6B00] font-bold text-[10px] text-black">
              S
            </div>
            <span className="font-bold tracking-tight text-white text-sm">
              Sonda Note
            </span>
          </Link>

          {/* Navigation Items (Capsule Pill Styles) */}
          <div className="flex items-center gap-2">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-full px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider font-semibold transition-all",
                    active 
                      ? "bg-[#FF6B00]/10 border border-[#FF6B00]/20 text-[#FF6B00]" 
                      : "border border-transparent text-neutral-400 hover:text-white"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Pane Profile & Sign Out */}
        <div className="flex items-center gap-6">
          {workspaceName && (
            <span className="hidden font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-bold sm:inline">
              WORKSPACE: {workspaceName}
            </span>
          )}
          <button
            onClick={signOut}
            title={email ?? undefined}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500 font-bold transition-all hover:text-red-400"
          >
            <span>Sign out</span>
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      </div>
    </nav>
  );
}
