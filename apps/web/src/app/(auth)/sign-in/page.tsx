import type { Metadata } from "next";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
	title: "Sign in",
	description: "Sign in to Still — your cinema diary and watchlist.",
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
