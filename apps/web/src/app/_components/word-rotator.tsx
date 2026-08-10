"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PHRASES = [
  "last quarter's decisions",
  "every open blocker",
  "who owns what",
  "that Razorpay thread",
  "six months of standups",
];

export function WordRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % PHRASES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center flex-wrap gap-2 text-2xl sm:text-3xl lg:text-4xl font-serif text-sn-ink">
      <span>Ask anything about</span>
      <span className="inline-block relative overflow-hidden align-bottom h-[1.2em]">
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block text-sn-accent border-b border-sn-accent font-normal"
          >
            {PHRASES[index]}
          </motion.span>
        </AnimatePresence>
      </span>

      {/* Static screen reader sentence for accessibility */}
      <span className="sr-only">
        Ask anything about last quarter's decisions, every open blocker, who owns what, or six months of standups.
      </span>
    </div>
  );
}
