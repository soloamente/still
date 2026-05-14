import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { authServer } from "@/lib/auth-server";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await authServer();
  if (!session) redirect("/sign-in");

  const api = await serverApi();
  const profileRes = await api.api.profiles.me.get().catch(() => ({ data: null }));
  const profile = (profileRes.data as {
    handle?: string;
    displayName?: string;
    bio?: string | null;
    favoriteMovieIds?: number[];
    onboardedAt?: string | null;
  } | null) ?? null;

  // If they've already finished onboarding, ferry them home.
  if (profile?.onboardedAt) redirect("/home");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:py-20">
      <OnboardingFlow
        initialProfile={{
          handle: profile?.handle ?? "",
          displayName: profile?.displayName ?? session.user.name ?? "",
          bio: profile?.bio ?? "",
          favoriteMovieIds: profile?.favoriteMovieIds ?? [],
        }}
      />
    </div>
  );
}
