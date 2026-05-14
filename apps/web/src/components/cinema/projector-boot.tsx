"use client";

import { useEffect, useState } from "react";

const BOOT_KEY = "still.cinemaBooted";

/**
 * One-time “lamp strike” across the authenticated shell: short multi-step opacity
 * ramp, then mark sessionStorage so repeat visits / BFcache navigations stay quiet.
 */
export function ProjectorBoot() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (sessionStorage.getItem(BOOT_KEY) === "1") {
      return;
    }

    setActive(true);
  }, []);

  const handleEnded = () => {
    sessionStorage.setItem(BOOT_KEY, "1");
    setActive(false);
  };

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120] bg-black cinema-projector-boot-overlay"
      onAnimationEnd={handleEnded}
    />
  );
}
