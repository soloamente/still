import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";

export const metadata: Metadata = {
	title: "Sign in",
	description: `Sign in to ${APP_NAME} — your cinema diary and watchlist.`,
};

export default async function SignInPage({
	searchParams,
}: {
	searchParams: Promise<{ from?: string }>;
}) {
	const { from } = await searchParams;
	const redirectTo =
		typeof from === "string" && from.startsWith("/") ? from : "/home";

	// Valid session: send patrons away before client auth chrome mounts (avoids a
	// blank flash while `AuthSessionRedirect` runs in `AuthPageShell`).
	const session = await authServer();
	if (session) {
		const profileResult = await fetchMeProfile();
		if (
			profileResult !== PROFILE_FETCH_FAILED &&
			patronNeedsOnboarding(profileResult)
		) {
			redirect("/onboarding");
		}
		redirect(redirectTo);
	}

	return <SignInForm redirectTo={redirectTo} />;
}
