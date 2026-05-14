"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Full-frame black veil on client navigations — reads like a splice between reels.
 * State is updated from `useLayoutEffect` (no `flushSync`) so React flushes before paint
 * without tripping the “flushSync inside lifecycle” guard in React 19 + Next 16.
 */
export function CinemaSceneCut({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const seededRef = useRef(false);
  const reduceMotionRef = useRef(false);
  /** Monotonic id so overlapping navigations never clobber veil state incorrectly. */
  const epochRef = useRef(0);
  const [veilEpoch, setVeilEpoch] = useState(0);

  useLayoutEffect(() => {
    reduceMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useLayoutEffect(() => {
    const prevPath = pathnameRef.current;
    pathnameRef.current = pathname;

    // First paint — no cut (cold load / onboarding redirect already happened).
    if (!seededRef.current) {
      seededRef.current = true;
      return;
    }

    if (prevPath === pathname || reduceMotionRef.current) return;

    epochRef.current += 1;
    const nextEpoch = epochRef.current;
    setVeilEpoch(nextEpoch);
  }, [pathname]);

  return (
    <>
      {children}
      {veilEpoch > 0 ? (
        <motion.div
          key={veilEpoch}
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] bg-black"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
          onAnimationComplete={() => {
            const fadeId = veilEpoch;
            setVeilEpoch((cur) => (cur === fadeId ? 0 : cur));
          }}
        />
      ) : null}
    </>
  );
}
