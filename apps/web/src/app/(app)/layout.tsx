import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CinemaSceneCut } from "@/components/cinema/cinema-scene-cut";
import { ProjectorBoot } from "@/components/cinema/projector-boot";
import { AppNav } from "@/components/app/app-nav";
import { CommandPaletteRoot } from "@/components/app/command-palette";
import { BadgeWatcher } from "@/components/gamification/badge-watcher";
import { ReviewComposerRoot } from "@/components/review/review-composer";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await authServer();
  if (!session) redirect("/sign-in");

  const api = await serverApi();
  const profileRes = await api.api.profiles.me.get().catch(() => ({ data: null }));
  const profile = (profileRes.data as { handle?: string; displayName?: string } | null) ?? null;

  // First-run users with no profile yet get nudged to onboarding.
  if (!profile?.handle) redirect("/onboarding");

  return (
    <div className="relative min-h-svh bg-background">
      {/* One-time projector warm-up flicker — client-only; below nav if both fire on boot. */}
      <ProjectorBoot />
      {/* Ultra-light grain sits above page chrome but below dialogs (z-50) so modals stay clean. */}
      <div className="pointer-events-none fixed inset-0 z-[35] cinema-grain" aria-hidden />
      <AppNav
        user={{
          id: session.user.id,
          name: session.user.name ?? profile.displayName ?? "",
          image: session.user.image ?? null,
          handle: profile.handle,
        }}
      />
      {/* Bottom padding clears the fixed floating nav + iOS safe area so content isn’t obscured. */}
      <main className="relative z-[36] pb-[max(6rem,calc(4.75rem+env(safe-area-inset-bottom,0px)))]">
        {/* No top padding so full-bleed routes (e.g. movie hero) can sit flush under the viewport top; pages add their own spacing when needed. */}
        <CinemaSceneCut>
          {/* Full-bleed reading width — no max-w shell on ultra-wide views (scene cut wraps this column). */}
          <div className="mx-auto w-full max-w-none px-4 pb-10 pt-0 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
            {children}
          </div>
        </CinemaSceneCut>
      </main>
      <CommandPaletteRoot />
      <ReviewComposerRoot />
      <BadgeWatcher />
    </div>
  );
}
