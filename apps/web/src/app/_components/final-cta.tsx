import React from "react";
import Link from "next/link";
import { Display } from "./display";
import { ButtonPrimary } from "./button-primary";
import { Eyebrow } from "./eyebrow";

export function FinalCta() {
  return (
    <div id="pricing" className="w-full bg-sn-invert text-sn-ink-on-invert rounded-[16px] p-10 sm:p-16 lg:p-20 text-center space-y-8 relative overflow-hidden">
      <div className="max-w-narrow mx-auto space-y-4">
        <Eyebrow text="FREE FOREVER FOR INDIVIDUALS" onInvert />
        <Display as="h2" size="h2" onInvert>
          Ready when your next meeting is.
        </Display>
        <p className="font-sans text-sm sm:text-base text-sn-ink-on-invert/70 leading-relaxed max-w-prose mx-auto">
          Start transcribing Google Meet in about ten seconds. Free forever for individuals.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <ButtonPrimary href="/login" onInvert>
          Add to Chrome — free
        </ButtonPrimary>
        <Link
          href="/login"
          className="text-xs font-sans font-medium text-sn-ink-on-invert/80 hover:text-sn-ink-on-invert transition-colors py-2 px-4"
        >
          Book a demo →
        </Link>
      </div>

      <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-xs font-sans text-sn-ink-on-invert/60">
        <span>✓ No credit card required</span>
        <span>✓ Installed in 10 seconds</span>
        <span>✓ Free individual tier</span>
      </div>
    </div>
  );
}
