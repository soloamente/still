import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";

export const metadata: Metadata = {
	title: "Create your account",
	description: `Join ${APP_NAME} — log films and TV, build lists, and follow friends.`,
};

export default async function SignUpPage() {
	const session = await authServer();
	if (session) {
		const profileResult = await fetchMeProfile();
		if (
			profileResult !== PROFILE_FETCH_FAILED &&
			patronNeedsOnboarding(profileResult)
		) {
			redirect("/onboarding");
		}
		redirect("/home");
	}

	return <SignUpForm />;
}
