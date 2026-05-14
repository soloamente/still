import { Button } from "@still/ui/components/button";
import { ArrowUpRight, Film, MessagesSquare, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { FrameStamp } from "@/components/cinema/frame-stamp";
import { Letterbox } from "@/components/cinema/letterbox";
import { serverApi } from "@/lib/server-api";

import { LandingPosterRail } from "./_marketing/landing-poster-rail";

export const metadata: Metadata = {
  title: "Still — your cinematic memory",
  description:
    "Log every film you watch, rate it, share it. A modern social home for cinephiles — diaries, reviews, lists, chat, and badges.",
};

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  // Signed-in visitors land on /home — keep the marketing surface for
  // logged-out browsers only so we don't render two front pages.
  const cookieStore = await cookies();
  const hasSession = ["better-auth.session_token", "__Secure-better-auth.session_token"].some(
    (n) => cookieStore.has(n),
  );
  if (hasSession) redirect("/home");

  const api = await serverApi();
  const popular = await api.api.movies.popular.get().catch(() => ({ data: null }));
  // Pull a handful of posters server-side so the hero rail isn't a CLS bomb.
  const posters: { id: number; title: string; posterUrl: string | null }[] =
    (popular.data as { results?: { id: number; title: string; poster_url: string | null }[] } | null)
      ?.results?.slice(0, 14)
      .map((m) => ({ id: m.id, title: m.title, posterUrl: m.poster_url })) ?? [];

  return (
    <div className="cinema-theater-floor relative min-h-svh overflow-hidden bg-background text-foreground">
      {/* Background grain + gradient — Aker mood. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_25%_-10%,rgba(183,89,40,0.18),transparent_55%),radial-gradient(50%_40%_at_85%_100%,rgba(4,65,82,0.25),transparent_60%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <BrandMark size="md" />
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          <Link href="#features" className="rounded-md px-3 py-2 hover:text-foreground">
            Features
          </Link>
          <Link href="#community" className="rounded-md px-3 py-2 hover:text-foreground">
            Community
          </Link>
          <Link href="#pro" className="rounded-md px-3 py-2 hover:text-foreground">
            Still Pro
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/sign-in">
            <Button variant="ghost-light" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/sign-up">
            <Button variant="accent" size="sm">
              Start logging
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pt-16 pb-24 md:pt-24">
        <div className="grid items-end gap-12 md:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-desert-orange" />
              Now in early access
            </p>
            <h1 className="font-display text-5xl font-medium leading-[0.95] tracking-[-0.025em] md:text-7xl">
              Every film, <br />
              <span className="text-desert-orange">remembered.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
              Still is a cinematic home for the films you&apos;ve seen, the lists you make, and the
              people who change your taste.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up">
                <Button variant="accent" size="pill-lg">
                  Create your account
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="ghost-light" size="pill-lg">
                  I already have one <ArrowUpRight className="ml-1 size-4" />
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free forever. Pro adds advanced stats, dark themes, and private lists.
            </p>
          </div>
          <div className="relative isolate hidden md:block">
            {/* Gate copy on the widescreen wedge — complements letterbox masking. */}
            <FrameStamp label="STILL · REEL 1 · 24FPS" className="z-[4]" />
            <Letterbox aspect="2.39" bars className="w-full">
              <LandingPosterRail posters={posters} />
            </Letterbox>
          </div>
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display text-3xl tracking-[-0.02em] md:text-4xl">
          A diary that knows what it&apos;s for.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<Film className="size-5 text-desert-orange" />}
            title="Diary &amp; ratings"
            body="Log every film with half-star precision. Rewatches, dates, and private notes — all on a single page."
          />
          <FeatureCard
            icon={<MessagesSquare className="size-5 text-desert-orange" />}
            title="Friends &amp; chat"
            body="Follow people whose taste you trust. Slide into DMs about that 1973 thriller everyone slept on."
          />
          <FeatureCard
            icon={<Trophy className="size-5 text-desert-orange" />}
            title="Badges &amp; quests"
            body="Earn quietly-prestigious achievements: 50 silents, every Kurosawa, a year of one-a-day."
          />
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-10 text-xs text-muted-foreground">
        <BrandMark size="sm" withTagline />
        <p>© {new Date().getFullYear()} Still</p>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 transition-colors duration-[var(--aker-duration)] hover:border-desert-orange/40">
      <div className="mb-4 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background/60">
        {icon}
      </div>
      <h3 className="font-serif text-lg tracking-[-0.01em]" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
