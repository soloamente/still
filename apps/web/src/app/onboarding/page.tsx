import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { authServer } from "@/lib/auth-server";
import type { OnboardingGateProfile } from "@/lib/onboarding-gate";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";
import { serverApi } from "@/lib/server-api";

export const metadata: Metadata = { title: "Welcome" };
export const dynamic = "force-dynamic";

type OnboardingPageProfile = NonNullable<OnboardingGateProfile> & {
	bio?: string | null;
	displayName?: string | null;
	isPro?: boolean | null;
};

export default async function OnboardingPage() {
	const session = await authServer();
	if (!session) redirect("/sign-in");

	const api = await serverApi();
	let profile: OnboardingPageProfile | null = null;
	let profileFetchFailed = false;
	try {
		const profileRes = await api.api.profiles.me.get();
		if (profileRes.error) {
			profileFetchFailed = true;
		} else {
			profile = (profileRes.data as OnboardingPageProfile | undefined) ?? null;
		}
	} catch {
		profileFetchFailed = true;
	}

	// Finished onboarding (or legacy grandfather) → home.
	if (!profileFetchFailed && profile && !patronNeedsOnboarding(profile)) {
		redirect("/home");
	}

	return (
		<OnboardingWizard
			emailVerified={session.user.emailVerified !== false}
			initialBio={profile?.bio ?? ""}
			initialDisplayName={profile?.displayName ?? session.user.name ?? ""}
			initialHandle={profile?.handle ?? ""}
			isPro={Boolean(profile?.isPro)}
			userEmail={session.user.email ?? ""}
		/>
	);
}
