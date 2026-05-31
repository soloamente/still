import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";
import { APP_NAME } from "@/lib/app-brand";

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

	return <SignInForm redirectTo={redirectTo} />;
}
