"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Button, Input, Spinner } from "@/components/ui";
import { AuthError, signIn, signUp } from "@/lib/auth";
import { Lock, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

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
      window.location.href = next;
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-sn-canvas text-sn-ink px-6 py-16">
      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 select-none mb-8 hover:opacity-90 transition-opacity">
          <div className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-sn-accent font-mono text-xs text-white">
            S
          </div>
          <span className="font-serif text-xl font-normal text-sn-ink">
            Sonda Note
          </span>
        </Link>

        {/* Card */}
        <div className="w-full bg-sn-surface border border-sn-hairline p-8 rounded-[12px] space-y-6">
          <div className="text-center space-y-1.5">
            <h2 className="font-serif text-2xl font-normal text-sn-ink leading-tight">
              {mode === "signin" ? "Sign in to workspace" : "Create new workspace"}
            </h2>
            <p className="text-xs text-sn-ink-secondary font-sans">
              {mode === "signin"
                ? "Enter your credentials to access Sonda Note"
                : "Get started with your Conversational Knowledge Engine"
              }
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="font-sans text-xs font-medium text-sn-ink-secondary mb-1.5 block" htmlFor="email">
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
                className="bg-sn-surface-raised border-sn-hairline text-sn-ink placeholder:text-sn-ink-tertiary focus:border-sn-hairline-strong transition-all rounded-[8px] py-2.5 px-3.5 text-xs font-sans"
              />
            </div>

            <div>
              <label className="font-sans text-xs font-medium text-sn-ink-secondary mb-1.5 block" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-sn-surface-raised border-sn-hairline text-sn-ink placeholder:text-sn-ink-tertiary focus:border-sn-hairline-strong transition-all rounded-[8px] py-2.5 px-3.5 text-xs font-sans"
              />
            </div>

            {error && (
              <div className="rounded-[8px] border border-sn-alert/30 bg-sn-alert-tint p-3 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-sn-alert shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-sn-alert font-sans">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[10px] bg-sn-invert text-sn-ink-on-invert font-sans font-medium py-2.5 px-6 text-xs transition-colors hover:bg-[#1A1B17] flex items-center justify-center gap-1.5"
            >
              {busy ? (
                <Spinner />
              ) : (
                <>
                  <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-sn-hairline"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono text-sn-ink-tertiary uppercase">OR</span>
            <div className="flex-grow border-t border-sn-hairline"></div>
          </div>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="w-full font-sans text-xs font-medium text-sn-ink-secondary hover:text-sn-ink transition-colors text-center"
          >
            {mode === "signin" ? "No account? Create one →" : "Already have an account? Sign in →"}
          </button>
        </div>

        {/* Security Indicator */}
        <div className="mt-6 flex items-center gap-2 text-sn-ink-tertiary justify-center text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-sn-live" />
          <span>Postgres Row-Level Isolation Enforced</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-sn-canvas text-sn-ink-tertiary">
          <Spinner />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
