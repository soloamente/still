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
	let profile: {
		handle?: string;
		displayName?: string;
		bio?: string | null;
		favoriteMovieIds?: number[];
		onboardedAt?: string | null;
	} | null = null;
	let profileFetchFailed = false;
	try {
		const profileRes = await api.api.profiles.me.get();
		if (profileRes.error) {
			profileFetchFailed = true;
		} else {
			profile = (profileRes.data as typeof profile) ?? null;
		}
	} catch {
		profileFetchFailed = true;
	}

	// If they've already finished onboarding, ferry them home (not when the API is down).
	if (!profileFetchFailed && profile?.onboardedAt) redirect("/home");

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
