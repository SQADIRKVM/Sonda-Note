"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Chrome,
  Play,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  BookOpen,
  Lock,
  Globe,
  Mic,
  Volume2,
  Database,
  Clock,
  Cpu,
  Terminal,
  Activity,
  Sliders,
  ChevronRight,
  HelpCircle,
  FolderLock,
  AlertCircle
} from "lucide-react";

/* ── Animation Variants ────────────────────────────────────────────────── */
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
} as const;

const staggerContainer = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.08 } },
  viewport: { once: true },
} as const;

/* ── Translation lookup mapping for transcription hovers ──────────────── */
const TRANSLATIONS: Record<string, string> = {
  "Postgres": "Postgres (Database infrastructure)",
  "Figma": "Figma (UI/UX design workspace)",
  "Next.js 15": "Next.js 15 (React application framework)",
  "Razorpay": "Razorpay (Payment processor sandbox)",
  "Sonda": "Sonda (Conversational Knowledge Engine)",
  "Standup start cheyyam": "Let's start the standup meeting",
  "designs for settings page ready aanu": "designs for the settings page are ready",
  "integration sandbox issue undarnnu": "integration sandbox had issues",
  "but yesterday resolve aayi": "but it got resolved yesterday",
  "dashboard deploy cheyyanam today": "dashboard needs to be deployed today"
};

export default function HomePage() {
  /* ── Interactive State Management ──────────────────────────────────────── */
  const [activeHeroTab, setActiveHeroTab] = useState<"transcript" | "summary">("transcript");
  const [vocabMode, setVocabMode] = useState<"cleaned" | "raw">("cleaned");

  // Interactive Task List State (Hero Summary)
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({
    task1: false,
    task2: true,
    task3: false,
  });

  const toggleTask = (id: string) => {
    setCheckedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Step 2: Vocabulary Engine Preview Mappings
  const vocabList = [
    { raw: "super base migration", clean: "Supabase migration" },
    { raw: "figure ma file", clean: "Figma file" },
    { raw: "raise pay sandbox", clean: "Razorpay sandbox" },
    { raw: "sounder deploy", clean: "Sonda deploy" },
  ];

  // Step 3: Summary Template Selection
  const [activeTemplate, setActiveTemplate] = useState<"standup" | "sales" | "client" | "discovery" | "review">("standup");

  // Step 4: Semantic Search & Simulated Audio Player
  const [searchQuery, setSearchQuery] = useState("sandbox callback");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(24); // Start at 24s (Razorpay citation)
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setPlaybackTime((prev) => {
          if (prev >= 29) {
            setIsPlaying(false);
            return 24;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  const triggerPlayback = () => {
    setPlaybackTime(24);
    setIsPlaying(true);
  };

  return (
    <div className="relative min-h-screen bg-[#070709] text-white font-sans selection:bg-[#FF6B00] selection:text-black antialiased overflow-x-hidden">

      {/* CSS For Continuous Infinite Marquee & Animations */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* ── Fixed Dot Grid Background Overlay ─────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80"
        aria-hidden="true"
      />

      {/* ── Fixed Ambient Aurora Glows (Amber Sonar Pulse & Mint Wave) ────── */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,107,0,0.06)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-[600px] w-[600px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,184,148,0.05)_0%,transparent_70%)] blur-3xl" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. STICKY NAVBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-neutral-950/80 backdrop-blur-md px-6 py-4 md:px-12 flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 select-none">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF6B00] font-bold text-xs text-black shadow-lg shadow-[#FF6B00]/20">
            S
          </div>
          <span className="font-bold tracking-tight text-white text-base">
            Sonda Note

          </span>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden items-center gap-8 text-sm font-medium text-neutral-400 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#vocabulary" className="transition-colors hover:text-white">Vocabulary Moat</a>
          <a href="#templates" className="transition-colors hover:text-white">Templates</a>
          <a href="#integrations" className="transition-colors hover:text-white">Integrations</a>
          <a href="#security" className="transition-colors hover:text-white">Security</a>
          <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B00] px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(255,107,0,0.3)] transition-all hover:bg-orange-400 hover:shadow-[0_0_28px_rgba(255,107,0,0.45)] hover:scale-[1.02]"
          >
            <span>Start Free</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          2. HERO SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-36 pb-20">
        <div className="flex flex-col items-center text-center">

          {/* Floating Pill Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-xs font-mono text-orange-400 tracking-wider">
            <span className="flex h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
            ● CONVERSATIONAL KNOWLEDGE ENGINE
          </div>

          {/* Main Headline */}
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight leading-[1.05] sm:text-6xl md:text-7xl text-white">
            Turn every meeting into structured, searchable <span className="text-[#FF6B00]">knowledge</span>.
          </h1>

          {/* Subtext */}
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-400 font-normal">
            Transcribes Malayalam + English code-mixed meetings in real time, auto-corrects company jargon, and turns conversations into actionable workflows.
          </p>

          {/* Capsule CTAs */}
          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#FF6B00] text-black font-semibold px-8 py-3.5 text-base shadow-[0_0_30px_rgba(255,107,0,0.4)] hover:scale-105 transition-transform"
            >
              <Chrome className="h-5 w-5" />
              <span>Add to Chrome — Free</span>
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-full bg-white/5 text-white border border-white/15 px-8 py-3.5 text-base hover:bg-white/10 transition-colors"
            >
              <span>Schedule Demo</span>
            </a>
          </div>

          {/* Social Proof Logo Cloud */}
          <div className="mt-16 flex flex-col items-center gap-4">
            <span className="font-mono text-xs tracking-widest text-neutral-500 uppercase">
              TRUSTED BY 500+ MODERN ENGINEERING TEAMS
            </span>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-xs font-semibold text-neutral-600">
              <span className="hover:text-neutral-400 transition-colors">SUPABASE</span>
              <span>·</span>
              <span className="hover:text-neutral-400 transition-colors">VERCEL</span>
              <span>·</span>
              <span className="hover:text-neutral-400 transition-colors">LINEAR</span>
              <span>·</span>
              <span className="hover:text-neutral-400 transition-colors">RAYCAST</span>
              <span>·</span>
              <span className="hover:text-neutral-400 transition-colors">PRISMA</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            3. HERO MEETING PLAYER FRAME (Supercut + Otter Interface)
        ══════════════════════════════════════════════════════════════════════ */}
        <motion.div
          id="demo"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-5xl mx-auto mt-12 rounded-2xl border border-white/15 bg-neutral-900/90 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -inset-4 bg-gradient-to-r from-orange-500/20 via-purple-500/10 to-teal-500/20 blur-3xl opacity-50 -z-10" />

          {/* Window Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-[#0e0e0e]/50 px-6 py-4 flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {/* macOS Dots */}
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
              </div>
              <span className="h-4 w-px bg-white/10 mx-1" />
              <span className="font-mono text-xs text-neutral-400">Google Meet — Sprint Sync (00:42)</span>
            </div>

            {/* Layout Toggles */}
            <div className="flex items-center gap-1.5 rounded-full bg-[#111111] border border-white/10 p-1">
              <button
                onClick={() => setActiveHeroTab("transcript")}
                className={`rounded-full px-4 py-1.5 font-mono text-[11px] font-semibold transition-all ${activeHeroTab === "transcript"
                    ? "bg-[#FF6B00] text-black shadow-md"
                    : "text-neutral-400 hover:text-white"
                  }`}
              >
                Live Transcript
              </button>
              <button
                onClick={() => setActiveHeroTab("summary")}
                className={`rounded-full px-4 py-1.5 font-mono text-[11px] font-semibold transition-all ${activeHeroTab === "summary"
                    ? "bg-[#FF6B00] text-black shadow-md"
                    : "text-neutral-400 hover:text-white"
                  }`}
              >
                AI Insights &amp; Board
              </button>
            </div>

            {/* Active Recording Pill */}
            <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 font-mono text-[10px] text-red-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              <span>RECORDING ACTIVE</span>
            </div>
          </div>

          {/* Soundwave wave visualizer (Mint Green #00B894) */}
          <div className="flex items-center gap-1 bg-black/40 px-6 py-2 border-b border-white/5 overflow-hidden">
            <span className="font-mono text-[9px] text-[#00B894] mr-2">SOUNDWAVE MINT</span>
            <div className="flex items-end gap-0.5 h-6 flex-1">
              {[20, 45, 60, 25, 90, 75, 40, 80, 55, 30, 70, 95, 50, 65, 80, 40, 30, 85, 60, 45, 90, 25, 75, 40, 60, 30, 80, 50, 95, 70, 40, 60, 85, 30, 55, 75, 20, 90, 45, 60, 30].map((h, i) => (
                <span
                  key={i}
                  style={{ height: `${h}%` }}
                  className="w-1 rounded-full bg-[#00B894] opacity-80"
                />
              ))}
            </div>
          </div>

          {/* Grid Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 min-h-[460px]">

            {/* Left Pane (60% width): Live transcript stream */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="p-6 flex-1 space-y-4 max-h-[400px] overflow-y-auto">
                <div className="text-[10px] font-mono text-neutral-500 mb-2 border-b border-white/5 pb-2 flex items-center justify-between">
                  <span>Hover underlined terms for translation lookup</span>
                  <HelpCircle className="h-3 w-3 text-neutral-500" />
                </div>
                <AnimatePresence mode="wait">
                  {activeHeroTab === "transcript" ? (
                    <motion.div
                      key="transcript"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {/* Speaker 1 • 00:04 */}
                      <div className="group/item relative rounded-xl border border-white/5 bg-neutral-900/30 p-4 transition-all duration-200 hover:border-white/10 hover:bg-neutral-900/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black font-mono border bg-[#FF6B00] border-[#FF6B00]">
                              R
                            </div>
                            <span className="font-mono text-xs font-bold text-white">Speaker 1 • Rahul Varma</span>
                            <span className="font-mono text-[10px] text-neutral-500">00:04</span>
                          </div>
                          <span className="rounded bg-[#00B894]/10 border border-[#00B894]/20 px-2 py-0.5 font-mono text-[9px] text-[#00B894]">VERIFIED SPEAKER</span>
                        </div>
                        <p className="text-sm leading-relaxed text-neutral-200 font-normal">
                          <span className="relative group/tool underline decoration-dashed decoration-[#00B894] cursor-help">
                            Standup start cheyyam
                            <span className="absolute bottom-full left-0 mb-2 w-48 hidden group-hover/tool:block bg-neutral-900 border border-white/10 text-[10px] text-neutral-300 rounded-lg p-2 shadow-xl z-20 font-mono">
                              {TRANSLATIONS["Standup start cheyyam"]}
                            </span>
                          </span>
                          . Yesterday njan{" "}
                          <span className="relative group/tool inline-flex items-center gap-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 text-xs font-mono cursor-help">
                            Postgres
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover/tool:block bg-neutral-900 border border-white/10 text-[10px] text-neutral-300 rounded-lg p-2 shadow-xl z-20 font-mono">
                              {TRANSLATIONS["Postgres"]}
                            </span>
                          </span>{" "}
                          schema migration complete cheythu, today API integration ready aakanam.
                        </p>
                      </div>

                      {/* Speaker 2 • 00:12 */}
                      <div className="group/item relative rounded-xl border border-white/5 bg-neutral-900/30 p-4 transition-all duration-200 hover:border-white/10 hover:bg-neutral-900/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white font-mono border bg-neutral-800 border-white/10">
                              A
                            </div>
                            <span className="font-mono text-xs font-bold text-white">Speaker 2 • Amrita Das</span>
                            <span className="font-mono text-[10px] text-neutral-500">00:12</span>
                          </div>
                          <span className="rounded bg-[#00B894]/10 border border-[#00B894]/20 px-2 py-0.5 font-mono text-[9px] text-[#00B894]">VERIFIED SPEAKER</span>
                        </div>
                        <p className="text-sm leading-relaxed text-neutral-200 font-normal">
                          The new settings dashboard templates are already published on{" "}
                          <span className="relative group/tool inline-flex items-center gap-1 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 px-1.5 py-0.5 text-xs font-mono cursor-help">
                            Figma
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 hidden group-hover/tool:block bg-neutral-900 border border-white/10 text-[10px] text-neutral-300 rounded-lg p-2 shadow-xl z-20 font-mono">
                              {TRANSLATIONS["Figma"]}
                            </span>
                          </span>{" "}
                          yesterday night. Let me know if the styling alignment is correct.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="summary-tab"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="rounded-xl border border-white/5 bg-neutral-900/30 p-5">
                        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-[#FF6B00]" />
                          <span>AI Executive Summary</span>
                        </h4>
                        <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                          Sprint update sync focusing on backend Postgres database migration completion, settings page design handoff, and Razorpay webhook integrations. Malayalam jargon was automatically cleaned and mapped.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Pane (40% width): Live AI Summary Sidebar */}
            <div className="lg:col-span-5 bg-neutral-900/20 p-6 flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <span className="font-mono text-xs font-bold text-[#FF6B00] uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="h-4 w-4" />
                  <span>AI Summary Board</span>
                </span>
                <span className="rounded bg-[#00B894]/10 border border-[#00B894]/20 px-2.5 py-0.5 font-mono text-[9px] text-[#00B894]">
                  LIVE SYNC ACTIVE
                </span>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto max-h-[360px]">

                {/* Blockers Row */}
                <div className="rounded-xl border border-red-500/10 bg-red-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-red-400 uppercase tracking-wider mb-2">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                    <span>BLOCKER DETECTED</span>
                  </div>
                  <p className="text-xs text-neutral-200">
                    Razorpay sandbox API callbacks are experiencing connection timeout issues.
                  </p>
                </div>

                {/* Decisions Row */}
                <div className="rounded-xl border border-teal-500/10 bg-teal-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-400 uppercase tracking-wider mb-2">
                    <Database className="h-3.5 w-3.5 text-teal-400" />
                    <span>KEY DECISION</span>
                  </div>
                  <p className="text-xs text-neutral-200">
                    Production database migration to Neon serverless database context approved.
                  </p>
                </div>

                {/* Action items with Mint Green Soundwave Mint checkmark boxes */}
                <div className="space-y-2">
                  <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">Action Items</span>

                  {/* Task 1 */}
                  <div
                    onClick={() => toggleTask("task1")}
                    className="flex items-start gap-3 rounded-lg border border-white/5 bg-neutral-950/40 p-3 cursor-pointer hover:bg-neutral-950/80"
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checkedTasks.task1 ? "bg-[#00B894] border-[#00B894] text-black" : "border-white/20"
                      }`}>
                      {checkedTasks.task1 && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold text-neutral-200 ${checkedTasks.task1 ? "line-through text-neutral-500" : ""}`}>
                        Share Figma settings designs with dev team
                      </p>
                      <span className="text-[9px] font-mono text-neutral-500 mt-1 block">Assignee: Amrita D.</span>
                    </div>
                  </div>

                  {/* Task 2 */}
                  <div
                    onClick={() => toggleTask("task2")}
                    className="flex items-start gap-3 rounded-lg border border-white/5 bg-neutral-950/40 p-3 cursor-pointer hover:bg-neutral-950/80"
                  >
                    <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${checkedTasks.task2 ? "bg-[#00B894] border-[#00B894] text-black" : "border-white/20"
                      }`}>
                      {checkedTasks.task2 && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-xs font-semibold text-neutral-200 ${checkedTasks.task2 ? "line-through text-neutral-500" : ""}`}>
                        Complete Postgres schema migration setup
                      </p>
                      <span className="text-[9px] font-mono text-neutral-500 mt-1 block">Assignee: Rahul V.</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          4. 4-STEP FEATURE PROGRESSION
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative z-10 border-t border-white/10 py-28 bg-[#0a0a0a]/50">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-4 text-center">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#FF6B00]">
              01 - 04 / WORKFLOW
            </span>
          </div>
          {/* Headline */}
          <h2 className="mb-20 text-center text-3xl font-bold tracking-tight md:text-5xl leading-[1.05] text-white">
            From live conversation to automated execution
          </h2>

          <div className="relative space-y-16">

            {/* Dashed Timeline Connector Line */}
            <div className="absolute left-[33px] top-6 bottom-6 w-0.5 border-l border-dashed border-white/10 -z-10 hidden lg:block" />

            {/* STEP 1: RECORD */}
            <motion.div
              {...fadeInUp}
              className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-orange-500/40 transition-all duration-300"
            >
              <div className="lg:col-span-5 p-8 flex flex-col justify-center relative">
                <div className="absolute left-[-46px] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-neutral-900 border border-[#FF6B00] flex items-center justify-center text-[11px] font-bold text-[#FF6B00] font-mono hidden lg:flex z-10 shadow-lg shadow-orange-500/10">
                  01
                </div>

                <span className="font-mono text-xs font-bold text-[#FF6B00] mb-3">STEP 01</span>
                <h3 className="text-2xl font-bold tracking-tight text-white leading-[1.1]">Record</h3>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                  One-click Chrome extension for Google Meet. Bot-free desktop and browser capture.
                </p>
              </div>

              {/* Visual Card: Soundwave Waveform meter with recording indicator */}
              <div className="lg:col-span-7 bg-neutral-950/60 border-t lg:border-t-0 lg:border-l border-white/10 p-8 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl border border-white/15 bg-neutral-900 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-neutral-400">INPUT MONITOR: GOOGLE MEET</span>
                    <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-mono text-[9px] text-red-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                      <span>RECORDING</span>
                    </div>
                  </div>

                  {/* Level meter Waveform (Mint Green #00B894) */}
                  <div className="h-16 flex items-end justify-center gap-1 bg-black/40 rounded-lg p-3 border border-white/5">
                    {[30, 60, 25, 90, 45, 70, 30, 85, 55, 40, 75, 20, 95, 60, 35, 80, 50, 65, 30, 75, 25, 90, 45, 60, 30].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className="w-1.5 rounded-full bg-[#00B894]"
                      />
                    ))}
                  </div>

                  <div className="flex justify-between font-mono text-[9px] text-neutral-500">
                    <span>VAD ACTIVE</span>
                    <span>44.1 kHz STEREO</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* STEP 2: CLEAN */}
            <motion.div
              {...fadeInUp}
              id="vocabulary"
              className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-orange-500/40 transition-all duration-300"
            >
              <div className="lg:col-span-5 p-8 flex flex-col justify-center relative">
                <div className="absolute left-[-46px] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-neutral-900 border border-[#00B894] flex items-center justify-center text-[11px] font-bold text-[#00B894] font-mono hidden lg:flex z-10 shadow-lg shadow-teal-500/10">
                  02
                </div>

                <span className="font-mono text-xs font-bold text-[#00B894] mb-3">STEP 02</span>
                <h3 className="text-2xl font-bold tracking-tight text-white leading-[1.1]">Clean</h3>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                  Workspace Vocabulary Engine. Automatically converts phonetic jargon into exact company terms.
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => setVocabMode("raw")}
                    className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] font-semibold border transition-all ${vocabMode === "raw"
                        ? "bg-neutral-800 text-white border-white/20"
                        : "bg-transparent text-neutral-400 border-white/10 hover:text-white"
                      }`}
                  >
                    Raw Speech
                  </button>
                  <button
                    onClick={() => setVocabMode("cleaned")}
                    className={`rounded-full px-3.5 py-1.5 font-mono text-[10px] font-semibold border transition-all ${vocabMode === "cleaned"
                        ? "bg-[#00B894]/10 text-[#00B894] border-[#00B894]/30"
                        : "bg-transparent text-neutral-400 border-white/10 hover:text-white"
                      }`}
                  >
                    Cleaned Term
                  </button>
                </div>
              </div>

              {/* Visual Card: Before/After jargon box ("super base" -> Supabase, "at miss" -> Sonda Note) */}
              <div className="lg:col-span-7 bg-neutral-950/60 border-t lg:border-t-0 lg:border-l border-white/10 p-8 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="font-mono text-[10px] font-bold text-[#00B894]">VOCABULARY ENGINE</span>
                    <span className="font-mono text-[9px] text-neutral-500">MAPPING LAYER</span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center bg-[#070709] border border-white/5 p-3 rounded-lg">
                      <span className="text-neutral-500">"super base"</span>
                      <ArrowRight className="h-3 w-3 text-neutral-600" />
                      <span className={`font-bold transition-all ${vocabMode === "cleaned" ? "text-teal-400" : "text-neutral-400"}`}>Supabase</span>
                    </div>

                    <div className="flex justify-between items-center bg-[#070709] border border-white/5 p-3 rounded-lg">
                      <span className="text-neutral-500">"at miss"</span>
                      <ArrowRight className="h-3 w-3 text-neutral-600" />
                      <span className={`font-bold transition-all ${vocabMode === "cleaned" ? "text-teal-400" : "text-neutral-400"}`}>Sonda Note</span>
                    </div>

                    <div className="flex justify-between items-center bg-[#070709] border border-white/5 p-3 rounded-lg">
                      <span className="text-neutral-500">"figure ma"</span>
                      <ArrowRight className="h-3 w-3 text-neutral-600" />
                      <span className={`font-bold transition-all ${vocabMode === "cleaned" ? "text-teal-400" : "text-neutral-400"}`}>Figma</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* STEP 3: SUMMARIZE */}
            <motion.div
              {...fadeInUp}
              id="templates"
              className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-orange-500/40 transition-all duration-300"
            >
              <div className="lg:col-span-5 p-8 flex flex-col justify-center relative">
                <div className="absolute left-[-46px] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-neutral-900 border border-[#9B72CF] flex items-center justify-center text-[11px] font-bold text-[#9B72CF] font-mono hidden lg:flex z-10 shadow-lg shadow-purple-500/10">
                  03
                </div>

                <span className="font-mono text-xs font-bold text-[#9B72CF] mb-3">STEP 03</span>
                <h3 className="text-2xl font-bold tracking-tight text-white leading-[1.1]">Summarize</h3>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                  5 Purpose-Built Meeting Templates. Instant summaries for Client Calls, Sales, Standups, Discovery, or Reviews.
                </p>

                {/* Horizontal Tab controls */}
                <div className="mt-6 flex flex-wrap gap-2">
                  {[
                    { id: "standup", label: "Standup" },
                    { id: "sales", label: "Sales Pitch" },
                    { id: "client", label: "Client Sync" },
                    { id: "discovery", label: "Discovery" },
                    { id: "review", label: "Sprint Retro" }
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTemplate(t.id as any)}
                      className={`rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold border transition-all ${activeTemplate === t.id
                          ? "bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/30"
                          : "bg-transparent text-neutral-400 border-white/10 hover:text-white"
                        }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual Card: Interactive tab switcher updating summary previews live */}
              <div className="lg:col-span-7 bg-neutral-950/60 border-t lg:border-t-0 lg:border-l border-white/10 p-8 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-5 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-orange-400">ACTIVE TEMPLATE: {activeTemplate.toUpperCase()}</span>
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                  </div>

                  <div className="space-y-3">
                    {activeTemplate === "standup" && (
                      <div className="space-y-2">
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-[#00B894] font-bold">COMPLETED</div>
                          <p className="text-xs text-neutral-300 font-normal">Neon database migrations complete.</p>
                        </div>
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-red-400 font-bold">BLOCKERS</div>
                          <p className="text-xs text-neutral-300 font-normal">Razorpay webhook timeouts on sandbox API.</p>
                        </div>
                      </div>
                    )}

                    {activeTemplate === "sales" && (
                      <div className="space-y-2">
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-purple-400 font-bold">BUDGET &amp; TIMELINE</div>
                          <p className="text-xs text-neutral-300 font-normal">₹4,00,000 INR budget cleared. Submit roadmap by Friday.</p>
                        </div>
                      </div>
                    )}

                    {activeTemplate === "client" && (
                      <div className="space-y-2">
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-teal-400 font-bold">CLIENT SYNC FEEDBACK</div>
                          <p className="text-xs text-neutral-300 font-normal">Client requested responsive dark mode options across all user screens.</p>
                        </div>
                      </div>
                    )}

                    {activeTemplate === "discovery" && (
                      <div className="space-y-2">
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-yellow-400 font-bold">KEY FINDINGS</div>
                          <p className="text-xs text-neutral-300 font-normal">Workspace onboarding takes 45 minutes manually; needs API sync features.</p>
                        </div>
                      </div>
                    )}

                    {activeTemplate === "review" && (
                      <div className="space-y-2">
                        <div className="bg-[#070709] border border-white/5 rounded p-3">
                          <div className="font-mono text-[9px] text-blue-400 font-bold">VELOCITY METRICS</div>
                          <p className="text-xs text-neutral-300 font-normal">42 story points shipped. Next sprint focuses on pipeline accuracy.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* STEP 4: ACT & QUERY */}
            <motion.div
              {...fadeInUp}
              className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl overflow-hidden shadow-2xl hover:border-orange-500/40 transition-all duration-300"
            >
              <div className="lg:col-span-5 p-8 flex flex-col justify-center relative">
                <div className="absolute left-[-46px] top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-neutral-900 border border-[#FDCB6E] flex items-center justify-center text-[11px] font-bold text-[#FDCB6E] font-mono hidden lg:flex z-10 shadow-lg shadow-yellow-500/10">
                  04
                </div>

                <span className="font-mono text-xs font-bold text-[#FDCB6E] mb-3">STEP 04</span>
                <h3 className="text-2xl font-bold tracking-tight text-white leading-[1.1]">Act &amp; Query</h3>
                <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                  Ask AI anything about past meetings via RAG search, or sync action items to Slack &amp; Notion.
                </p>
              </div>

              {/* Visual Card: RAG search modal ("Ask Sonda Note anything...") with Indigo Ray (#6366F1) outline */}
              <div className="lg:col-span-7 bg-neutral-950/60 border-t lg:border-t-0 lg:border-l border-white/10 p-8 flex items-center justify-center">
                <div className="w-full max-w-sm rounded-xl border border-[#6366F1]/50 bg-neutral-900 p-5 space-y-4 shadow-[0_0_25px_rgba(99,102,241,0.15)]">

                  {/* Search box */}
                  <div className="flex items-center gap-2 bg-[#070709] border border-white/10 rounded-lg px-3 py-2.5">
                    <Search className="h-4 w-4 text-[#6366F1]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-0 outline-none text-xs text-white placeholder:text-neutral-600 font-mono w-full"
                      placeholder="Ask Sonda Note anything..."
                    />
                    <span className="font-mono text-[9px] text-[#6366F1] bg-[#6366F1]/10 px-1.5 py-0.5 rounded border border-[#6366F1]/20">⌘K</span>
                  </div>

                  {/* Playback citation (Indigo Ray timestamp badges) */}
                  <div className="rounded-lg border border-[#6366F1]/20 bg-[#6366F1]/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono">
                      <span>RAG MATCH INDEX</span>
                      <span className="bg-[#6366F1] text-white px-2 py-0.5 rounded text-[8px]">00:24</span>
                    </div>
                    <p className="text-xs text-neutral-300 italic font-sans leading-relaxed">
                      "...Razorpay sandbox callback issues complete cheythu..."
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. INTEGRATIONS MARQUEE (Continuously Scrolling Row)
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="integrations" className="relative z-10 border-t border-white/10 py-16 bg-neutral-950 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 mb-6 text-center">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#6366F1]">
            INTEGRATIONS
          </span>
        </div>

        {/* Marquee Row */}
        <div className="relative flex overflow-x-hidden">
          <div className="flex gap-8 whitespace-nowrap animate-marquee py-4">
            {[
              "Google Meet", "Slack", "Notion", "Jira", "Salesforce", "Claude MCP", "Google Drive", "Zoom",
              "Google Meet", "Slack", "Notion", "Jira", "Salesforce", "Claude MCP", "Google Drive", "Zoom"
            ].map((app, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-[#0e0e0c]/60 px-6 py-3 font-mono text-xs text-neutral-300 shadow-md transition-all hover:border-[#FF6B00]/40"
              >
                <div className="h-2 w-2 rounded-full bg-[#00B894]" />
                <span>{app.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-neutral-950 to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          6. COMPETITIVE MOAT (3-Column Grid)
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="vocabulary-moat" className="relative z-10 border-t border-white/5 py-28 bg-[#070709]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-4 text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-[#00B894] font-bold">
              COMPETITIVE MOAT
            </span>
          </div>

          <h2 className="mb-20 text-center text-3xl font-bold tracking-tight md:text-5xl leading-[1.05] text-white">
            Why modern tech teams switch to Sonda Note
          </h2>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

            {/* Moat Card 1 */}
            <div className="rounded-2xl border border-white/10 bg-[#0e0e0c]/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-orange-500/30">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Globe className="h-5 w-5 text-[#FF6B00]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white leading-[1.1]">Malayalam &amp; Code-Mixed First</h3>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                Handles Manglish and Indic speech natively. No broken literal translation — just natural comprehension.
              </p>
            </div>

            {/* Moat Card 2 */}
            <div className="rounded-2xl border border-white/10 bg-[#0e0e0c]/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-teal-500/30">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/20">
                <BookOpen className="h-5 w-5 text-[#00B894]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white leading-[1.1]">Per-Workspace Vocabulary</h3>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                Custom dictionary that learns brand names, codebase jargon, and tools, improving with every user edit.
              </p>
            </div>

            {/* Moat Card 3 */}
            <div className="rounded-2xl border border-white/10 bg-[#0e0e0c]/40 p-8 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/30">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Lock className="h-5 w-5 text-[#9B72CF]" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white leading-[1.1]">Grounded &amp; Private</h3>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400 font-normal">
                Timestamped transcript citations with Postgres row-level isolation guarantees complete data confidentiality.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          7. ENTERPRISE SECURITY GRID
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="security" className="relative z-10 border-t border-white/5 bg-[#070709] py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-4 text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-[#00B894] font-bold">
              SECURITY
            </span>
          </div>
          {/* Section heading */}
          <h2 className="mb-16 text-center text-3xl font-bold tracking-tight md:text-4xl leading-[1.05] text-white">
            Enterprise security &amp; data isolation by default
          </h2>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Row-Level Security",
                body: "Postgres RLS ensures strict data isolation. Each workspace is a hermetically sealed context data pool.",
              },
              {
                title: "SOC 2 Alignment",
                body: "End-to-end TLS encryption in transit and AES-256 at rest. Comprehensive system audit logging.",
              },
              {
                title: "GDPR Compliance",
                body: "Complete customer deletion control tools. Export workspace logs instantly at any time.",
              },
              {
                title: "Local Data Hosting",
                body: "Private server integrations via SQLite mode. Audio records never leave local networks.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="border-t border-white/10 pt-6 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white uppercase tracking-wider mb-2 font-mono">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-neutral-400 font-normal">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          8. FINAL CTA BANNER
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative z-10 border-t border-white/5 py-32 bg-[#070709]">
        <div className="mx-auto max-w-4xl px-6">
          <div className="bg-gradient-to-b from-neutral-900 to-black border border-white/15 rounded-3xl p-12 text-center relative overflow-hidden">
            <span className="font-mono text-xs text-orange-400 uppercase tracking-widest mb-6 block">Individuals Free Forever</span>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-[1.05] mb-6">
              Ready to automate your meeting notes?
            </h2>
            <p className="text-neutral-400 mb-8 max-w-xl mx-auto text-sm sm:text-base leading-relaxed font-normal">
              Start transcribing Google Meet sessions in seconds. Free forever for individuals.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#FF6B00] text-black font-semibold px-8 py-3.5 text-sm shadow-[0_0_30px_rgba(255,107,0,0.3)] hover:scale-105 transition-transform"
              >
                <Chrome className="h-5 w-5" />
                <span>Add to Chrome — Free</span>
              </Link>
              <a
                href="/sonda-note-product.html"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#141410] px-8 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <span>Schedule Demo</span>
              </a>
            </div>

            {/* Muted Sub-CTA verification labels */}
            <div className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-[10px] text-neutral-500 uppercase tracking-wider">
              <span>No credit card required</span>
              <span>·</span>
              <span>Installed in 10 seconds</span>
              <span>·</span>
              <span>Cancel at any time</span>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          9. FOOTER
      ══════════════════════════════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-white/5 bg-[#070709] py-16 text-xs text-neutral-500 font-mono">
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#FF6B00] font-bold text-[10px] text-black">S</div>
              <span className="font-sans font-bold text-sm text-white">Sonda Note</span>
            </div>
            <p className="leading-relaxed font-normal">
              Malayalam &amp; Code-Mixed Meeting Intelligence Platform.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[#00B894]">
              <span className="h-1 w-1 rounded-full bg-[#00B894] animate-pulse" />
              <span className="font-mono text-[9px] uppercase tracking-wider">
                Self-Hosted &amp; Private
              </span>
            </div>
          </div>

          <div>
            <div className="font-sans font-bold text-white text-sm mb-4">Product</div>
            <ul className="space-y-2.5">
              <li><a href="#features" className="hover:text-white transition-colors">Workflow Features</a></li>
              <li><a href="#vocabulary" className="hover:text-white transition-colors">Vocabulary Engine</a></li>
              <li><a href="#templates" className="hover:text-white transition-colors">Custom Templates</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing Options</a></li>
            </ul>
          </div>

          <div>
            <div className="font-sans font-bold text-white text-sm mb-4">Security</div>
            <ul className="space-y-2.5">
              <li><a href="#security" className="hover:text-white transition-colors">Data Isolation (RLS)</a></li>
              <li><a href="#security" className="hover:text-white transition-colors">SOC 2 &amp; GDPR</a></li>
              <li><a href="/sonda-note-product.html" className="hover:text-white transition-colors">Platform Architecture</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Principles</a></li>
            </ul>
          </div>

          <div>
            <div className="font-sans font-bold text-white text-sm mb-4">Account</div>
            <ul className="space-y-2.5">
              <li><Link href="/login" className="hover:text-white transition-colors">Login Workspace</Link></li>
              <li><Link href="/login" className="hover:text-white transition-colors">Register Free</Link></li>
              <li><a href="/sonda-note-product.html" className="hover:text-white transition-colors">Enterprise Demo</a></li>
            </ul>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-6 mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px]">
          <span>© 2026 Sonda Note · All rights reserved.</span>
          <span>Self-hosted WhisperX + Neon Serverless Postgres + Next.js</span>
        </div>
      </footer>

    </div>
  );
}
