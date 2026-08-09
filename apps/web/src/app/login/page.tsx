"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthError, signIn, signUp } from "@/lib/auth";
import { Lock, Sparkles, AlertCircle, ArrowRight } from "lucide-react";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/meetings";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      // Full navigation so middleware sees the cookie that was just set.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#070709] px-6 py-16 overflow-hidden">

      {/* ── Fixed Dot Grid Background Overlay ─────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[linear-gradient(to_right,#1f1f1f_1px,transparent_1px),linear-gradient(to_bottom,#1f1f1f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-80"
        aria-hidden="true"
      />

      {/* ── Ambient Glows (Sonar Amber & Soundwave Mint) ──────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,107,0,0.06)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,184,148,0.05)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">

        {/* Logo Container */}
        <Link href="/" className="flex items-center gap-3 select-none mb-8 hover:opacity-90 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF6B00] font-bold text-sm text-black shadow-lg shadow-[#FF6B00]/20">
            S
          </div>
          <span className="font-bold tracking-tight text-white text-xl">
            Sonda Note
          </span>
        </Link>

        {/* Glassmorphic Form Card */}
        <div className="w-full bg-[#121216]/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-white leading-tight">
              {mode === "signin" ? "Sign in to workspace" : "Create new workspace"}
            </h2>
            <p className="text-xs text-neutral-400 font-sans">
              {mode === "signin"
                ? "Enter your credentials to link Sonda Note"
                : "Get started with your Conversational Knowledge Engine"
              }
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 mb-2 block" htmlFor="email">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="bg-[#070709]/80 border-white/10 text-white placeholder:text-neutral-600 focus:border-[#FF6B00]/50 focus:ring-1 focus:ring-[#FF6B00]/30 transition-all rounded-lg py-2.5 px-3.5 text-sm"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 block" htmlFor="password">
                  Password
                </label>
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#070709]/80 border-white/10 text-white placeholder:text-neutral-600 focus:border-[#FF6B00]/50 focus:ring-1 focus:ring-[#FF6B00]/30 transition-all rounded-lg py-2.5 px-3.5 text-sm"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-red-400 font-normal">
                  {error}
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#FF6B00] text-black font-semibold py-3 px-6 text-sm shadow-[0_0_20px_rgba(255,107,0,0.25)] transition-all hover:bg-orange-400 hover:shadow-[0_0_28px_rgba(255,107,0,0.4)] hover:scale-[1.01] flex items-center justify-center gap-1.5"
            >
              {busy ? (
                <Spinner />
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </>
              )}
            </Button>
          </form>

          {/* Mode Switch Button */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono text-neutral-600 uppercase">OR</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="w-full font-mono text-xs font-semibold text-neutral-400 transition-colors hover:text-white text-center"
          >
            {mode === "signin" ? "No account? Create one →" : "Already have an account? Sign in →"}
          </button>
        </div>

        {/* Security Indicator */}
        <div className="mt-8 flex items-center gap-2 text-neutral-500 justify-center">
          <Lock className="h-3.5 w-3.5 text-neutral-500" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            Row-Level Data Isolation Enforced
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#070709] text-smoke">
          <Spinner />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
