import type { Transition, Variants } from "framer-motion";

export const EXPO = [0.16, 1, 0.3, 1] as const;

const base: Transition = { duration: 0.7, ease: EXPO };

export const VIEWPORT = { once: true, margin: "0px 0px -15% 0px" } as const;

/** Below the fold. Scroll-triggered. */
export const revealIn = (delay = 0, y = 20) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { ...base, delay },
});

/** Above the fold. Fires on mount, no observer, no blank fold. */
export const enterIn = (delay = 0, y = 20) => ({
  initial: { opacity: 0, y },
  animate: { opacity: 1, y: 0 },
  transition: { ...base, delay },
});

/** For grids and lists that need stagger. */
export const revealParent: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07 } },
};

export const revealChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  shown: { opacity: 1, y: 0, transition: base },
};
