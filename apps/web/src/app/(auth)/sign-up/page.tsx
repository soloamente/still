import type { Metadata } from "next";
import Link from "next/link";

import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = {
	title: "Create your account",
};

export default function SignUpPage() {
	return (
		<div className="space-y-8">
			<header className="space-y-2">
				<h1 className="font-medium font-sans text-3xl tracking-[-0.02em]">
					Start your diary
				</h1>
				<p className="text-muted-foreground text-sm">
					Log every film. Build lists. Find people whose taste sharpens yours.
				</p>
			</header>
			<SignUpForm />
			<p className="text-center text-muted-foreground text-sm">
				Already have an account?{" "}
				<Link
					href="/sign-in"
					className="text-foreground underline-offset-4 hover:underline"
				>
					Sign in
				</Link>
			</p>
		</div>
	);
}
