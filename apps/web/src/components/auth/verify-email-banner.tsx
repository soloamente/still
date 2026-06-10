"use client";

import { Button } from "@still/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

/** Minimal session slice passed from the `(app)` RSC layout — avoids `server-only` imports. */
export type VerifyEmailBannerSession = {
	user: {
		email?: string;
		emailVerified?: boolean;
	};
};

type VerifyEmailBannerProps = {
	session: VerifyEmailBannerSession;
};

/**
 * Persistent strip for unverified patrons — blocks public/social actions server-side
 * but keeps private diary/onboarding usable. Clears after verify link + refresh.
 */
export function VerifyEmailBanner({
	session: serverSession,
}: VerifyEmailBannerProps) {
	const { data: clientSession } = authClient.useSession();
	const [resending, setResending] = useState(false);

	// Prefer live client session so the banner disappears after verification.
	const session = clientSession ?? serverSession;
	const user = session?.user;

	if (!user || user.emailVerified !== false) {
		return null;
	}

	async function handleResend() {
		const email = user?.email;
		if (!email) {
			toast.error("No email on file");
			return;
		}

		setResending(true);
		try {
			const { error } = await authClient.sendVerificationEmail({
				email,
				callbackURL: "/home",
			});
			if (error) {
				toast.error(error.message ?? "Could not send verification email");
				return;
			}
			toast.success("Verification email sent");
		} catch {
			toast.error("Could not send verification email");
		} finally {
			setResending(false);
		}
	}

	return (
		<div className="flex flex-wrap items-center justify-center gap-3 bg-card px-2.5 py-2.5 text-sm">
			<span className="text-pretty text-center text-foreground">
				Verify your email to share reviews, lists, and your profile publicly.
			</span>
			<Button
				type="button"
				size="sm"
				variant="secondary"
				className="shrink-0"
				disabled={resending}
				onClick={handleResend}
			>
				{resending ? "Sending…" : "Resend email"}
			</Button>
		</div>
	);
}
