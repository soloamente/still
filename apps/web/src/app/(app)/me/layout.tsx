import { redirect } from "next/navigation";

import { MeAccountShell } from "@/components/profile/me-account-shell";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";

export default async function MeLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await authServer();
	if (!session) {
		redirect("/sign-in");
	}

	const profileResult = await fetchMeProfile();
	if (profileResult === PROFILE_FETCH_FAILED) {
		// API unavailable — don't mis-route patrons into onboarding.
		throw new Error("Could not load your profile. Try again in a moment.");
	}
	if (patronNeedsOnboarding(profileResult)) {
		redirect("/onboarding");
	}
	if (!profileResult?.handle) {
		redirect("/onboarding");
	}

	return (
		<MeAccountShell handle={profileResult.handle}>{children}</MeAccountShell>
	);
}
