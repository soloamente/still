import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";

/**
 * Cinematic split layout: a hero column with a still-image vignette
 * (gradient + grain placeholder) on the left, the form column on the
 * right. Mobile collapses to a single column, hero becomes a band.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-deep-graphite lg:flex">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_80%_at_30%_20%,rgba(183,89,40,0.25),transparent_60%),radial-gradient(80%_60%_at_70%_90%,rgba(119,97,87,0.25),transparent_60%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[url('https://image.tmdb.org/t/p/original/zfbjgQE1uSd9wiPTX4VzsLi0rGG.jpg')] bg-cover bg-center opacity-30 mix-blend-luminosity"
        />
        <div className="relative z-10 flex w-full flex-col justify-between p-10">
          <BrandMark size="lg" />
          <div>
            <p className="font-display text-2xl leading-snug text-pure-white/85 max-w-md">
              &ldquo;Film is a disease. When it infects your bloodstream it takes over as the
              number one hormone.&rdquo;
            </p>
            <p className="mt-3 text-sm text-slate-border">— Frank Capra</p>
          </div>
        </div>
      </aside>
      <main className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 lg:hidden">
          <BrandMark />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back home
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
