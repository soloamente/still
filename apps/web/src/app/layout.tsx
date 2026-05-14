import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Agentation } from "agentation";
import { DialRoot } from "dialkit";
import "dialkit/styles.css";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";

import "../index.css";
import Providers from "@/components/providers";

/**
 * UI sans (body, controls, microcopy) stays on **Inter** via `font-sans`.
 * Long-form editorial copy stays on **Inter** via `font-editorial` (open tracking).
 * Display headlines (movie titles, landing hero, profile names, page H1s) move to
 * **Fraunces** via the new `font-display` utility — a cinematic editorial serif
 * with an optical-size axis. See `.cursor/scratchpad.md` Phase 1.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  // Variable font: full wght range is included by default. We opt into the
  // optical-size axis so headlines pick up the display cut (looser tracking,
  // sharper terminals) and small captions stay readable.
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Still — your cinematic memory",
    template: "%s · Still",
  },
  description:
    "Log every film you watch, rate it, share it. A modern social home for cinephiles — diaries, reviews, lists, chat, and badges.",
  applicationName: "Still",
};

export const viewport: Viewport = {
  themeColor: "#020202",
  colorScheme: "dark",
};

/**
 * Root shell: fonts, theme (`dark`), optional cinema atmosphere preset.
 * `NEXT_PUBLIC_CINEMA_PRESET=multiplex` → faster ticker, heavier grain (see `globals.css`).
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  /* next/font puts `--font-inter` on whichever node gets `variable`; it must live on
   * `<html>` so :root rules like `font-family: var(--font-sans)` resolve it (body-only
   * vars are invisible to `html`, which broke the stack → Times New Roman fallbacks). */
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${inter.className} ${geistMono.variable} ${fraunces.variable} dark`}
      data-cinema-preset={
        process.env.NEXT_PUBLIC_CINEMA_PRESET === "multiplex" ? "multiplex" : "arthouse"
      }
    >
      <body className="bg-background text-foreground antialiased">
        {/* DialKit dev panel: sibling of app tree (does not wrap {children}). */}
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === "development" ? <Agentation /> : null}
        <DialRoot />
      </body>
    </html>
  );
}
