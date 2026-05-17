import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
	title: "Sign in",
};

/** Lightweight stand-in while client `useSearchParams` hydrates (Next static prerender requirement). */
function SignInFormFallback() {
	return (
		<div
			className="space-y-4"
			aria-busy="true"
			aria-label="Loading sign-in form"
			role="status"
		>
			<div className="h-10 rounded-md border border-border bg-card/50" />
			<div className="h-10 rounded-md border border-border bg-card/50" />
			<div className="h-11 rounded-[var(--radius)] bg-muted/40" />
		</div>
	);
}

export default function SignInPage() {
	return (
		<div className="space-y-8">
			<header className="space-y-2">
				<h1 className="font-medium font-sans text-3xl tracking-[-0.02em]">
					Welcome back
				</h1>
				<p className="text-muted-foreground text-sm">
					Pick up your diary where you left off.
				</p>
			</header>
			{/* `useSearchParams` in `SignInForm` opts the route into CSR — Suspense satisfies the build-time contract. */}
			<Suspense fallback={<SignInFormFallback />}>
				<SignInForm />
			</Suspense>
			<p className="text-center text-muted-foreground text-sm">
				New to Still?{" "}
				<Link
					href="/sign-up"
					className="text-foreground underline-offset-4 hover:underline"
				>
					Create an account
				</Link>
			</p>
		</div>
	);
}
