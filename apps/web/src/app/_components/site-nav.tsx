"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  BookOpen,
  Sliders,
  Search,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  ShieldCheck,
  Lock,
} from "lucide-react";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMegaOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setMegaOpen(false);
    }, 150);
  };

  const megaRows = [
    {
      icon: Mic,
      title: "Live Malayalam & English Transcription",
      desc: "Real-time code-mixed speech capture directly from Google Meet without bot participants.",
      href: "#workflow",
    },
    {
      icon: BookOpen,
      title: "Workspace Vocabulary Engine",
      desc: "Per-workspace dictionary auto-correcting phonetically ambiguous jargon and brand names.",
      href: "#vocabulary",
    },
    {
      icon: Sliders,
      title: "Purpose-Built Meeting Templates",
      desc: "Instant structured summaries for Standups, Sales pitches, Discovery, and Sprint retros.",
      href: "#templates",
    },
    {
      icon: Search,
      title: "Search & Claude MCP Connector",
      desc: "Search grounded meeting memory and pass transcript history to any Claude AI model.",
      href: "#search",
    },
  ];

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-200 ${
        scrolled
          ? "bg-sn-canvas/85 backdrop-blur-md border-b border-sn-hairline"
          : "bg-sn-canvas border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-max px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-6 h-6 rounded-[6px] bg-sn-accent flex items-center justify-center text-white text-xs font-mono font-normal">
            S
          </div>
          <span className="font-serif text-lg font-normal text-sn-ink tracking-tight">
            Sonda Note
          </span>
          <span className="hidden sm:inline-block font-mono text-[10px] text-sn-ink-tertiary uppercase tracking-widest pl-1 border-l border-sn-hairline">
            BY ATMIZ
          </span>
        </Link>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-sans font-medium text-sn-ink-secondary">
          {/* Mega Dropdown Trigger */}
          <div
            className="relative py-4"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              className="flex items-center gap-1 hover:text-sn-ink transition-colors py-1 focus-visible:outline-none"
              aria-expanded={megaOpen}
            >
              <span>Product</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${megaOpen ? "rotate-180 text-sn-ink" : ""}`} />
            </button>

            {/* Mega Panel Dropdown */}
            {megaOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-[540px] bg-sn-surface border border-sn-hairline rounded-lg p-4 shadow-sm z-50 transition-opacity duration-150">
                <div className="grid grid-cols-1 gap-2">
                  {megaRows.map((row, idx) => {
                    const Icon = row.icon;
                    return (
                      <Link
                        key={idx}
                        href={row.href}
                        onClick={() => setMegaOpen(false)}
                        className="flex items-start gap-3.5 p-3 rounded-md hover:bg-sn-surface-raised transition-colors group"
                      >
                        <div className="p-2 rounded-md bg-sn-canvas border border-sn-hairline text-sn-ink-secondary group-hover:text-sn-accent group-hover:border-sn-hairline-strong transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-sn-ink group-hover:text-sn-accent transition-colors flex items-center gap-1.5">
                            <span>{row.title}</span>
                          </div>
                          <p className="text-[11px] text-sn-ink-tertiary leading-relaxed mt-0.5 font-normal">
                            {row.desc}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="mt-3 pt-3 border-t border-sn-hairline flex items-center justify-between text-[11px] text-sn-ink-tertiary px-3">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-sn-live" />
                    <span>Postgres RLS & SQLite Local Storage</span>
                  </span>
                  <Link href="#workflow" onClick={() => setMegaOpen(false)} className="text-sn-accent hover:underline flex items-center gap-1">
                    <span>Explore architecture</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link href="#vocabulary" className="hover:text-sn-ink transition-colors">
            Vocabulary
          </Link>
          <Link href="#security" className="hover:text-sn-ink transition-colors">
            Security
          </Link>
          <Link href="#pricing" className="hover:text-sn-ink transition-colors">
            Pricing
          </Link>
        </nav>

        {/* Right Action Items */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-xs font-sans font-medium text-sn-ink-secondary hover:text-sn-ink transition-colors hidden sm:inline-block"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-[10px] bg-sn-invert text-sn-ink-on-invert px-4 py-2 text-xs font-sans font-medium hover:bg-[#1A1B17] transition-colors"
          >
            Start free
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-sn-ink p-1.5 rounded-md hover:bg-sn-hairline transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      {mobileOpen && (
        <div className="md:hidden bg-sn-surface border-b border-sn-hairline px-6 py-6 space-y-4 text-sm font-sans font-medium">
          <Link href="#workflow" onClick={() => setMobileOpen(false)} className="block py-1 text-sn-ink">
            Product Features
          </Link>
          <Link href="#vocabulary" onClick={() => setMobileOpen(false)} className="block py-1 text-sn-ink">
            Vocabulary Engine
          </Link>
          <Link href="#security" onClick={() => setMobileOpen(false)} className="block py-1 text-sn-ink">
            Security & RLS
          </Link>
          <Link href="#pricing" onClick={() => setMobileOpen(false)} className="block py-1 text-sn-ink">
            Pricing
          </Link>
          <div className="pt-4 border-t border-sn-hairline flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center py-2.5 text-sn-ink-secondary rounded-md border border-sn-hairline"
            >
              Log in
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="w-full text-center py-2.5 bg-sn-invert text-sn-ink-on-invert rounded-[10px]"
            >
              Add to Chrome — free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
