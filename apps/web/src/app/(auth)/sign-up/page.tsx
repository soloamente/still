import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ReferralRefCapture } from "@/components/auth/referral-ref-capture";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { APP_NAME } from "@/lib/app-brand";
import { authServer } from "@/lib/auth-server";
import { fetchMeProfile, PROFILE_FETCH_FAILED } from "@/lib/fetch-me-profile";
import { patronNeedsOnboarding } from "@/lib/onboarding-gate";

export const metadata: Metadata = {
	title: "Create your account",
	description: `Join ${APP_NAME} — log films and TV, build lists, and follow friends.`,
};

type SignUpPageProps = {
	searchParams: Promise<{ ref?: string }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
	const session = await authServer();
	const { ref: referralCode } = await searchParams;
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

	return (
		<>
			<ReferralRefCapture referralCode={referralCode} />
			<SignUpForm />
		</>
	);
}
