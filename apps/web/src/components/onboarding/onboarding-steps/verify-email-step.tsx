"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { authClient } from "@/lib/auth-client";
import { stillApiOrigin } from "@/lib/still-api-origin";

type VerifyEmailStepProps = {
	userEmail: string;
	/** Advance the wizard once the session shows a verified email. */
	onVerified: () => void;
};

/**
 * Source of truth for onboarding — Postgres `user.email_verified` via fresh
 * session. Better Auth cookie-cache / client getSession stay stale after the
 * inbox link.
 */
async function fetchDbEmailVerified(): Promise<boolean | null> {
	const res = await fetch(`${stillApiOrigin()}/api/me/email-verified`, {
		credentials: "include",
		cache: "no-store",
	});
	if (!res.ok) return null;
	const data = (await res.json()) as { emailVerified?: boolean };
	return data.emailVerified === true;
}

/**
 * Gate before quick-rate — diary logs require a verified email when public.
 * Patrons can resend and refresh after clicking the inbox link.
 */
export function VerifyEmailStep({
	userEmail,
	onVerified,
}: VerifyEmailStepProps) {
	const router = useRouter();
	const [resending, setResending] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	async function handleResend() {
		if (!userEmail) {
			toast.error("No email on file");
			return;
		}

		setResending(true);
		try {
			const { error } = await authClient.sendVerificationEmail({
				email: userEmail,
				callbackURL: "/onboarding",
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

	async function handleVerified() {
		setRefreshing(true);
		try {
			const verified = await fetchDbEmailVerified();
			if (verified == null) {
				toast.error("Could not check verification — try again");
				return;
			}
			if (!verified) {
				// Local: signup never auto-sends mail; allow continue after Resend
				// attempts so taste isn't blocked when inbox links are awkward.
				if (process.env.NODE_ENV === "development") {
					toast.message("Dev: continuing without a verified email");
					onVerified();
					router.refresh();
					return;
				}
				toast.error("Email not verified yet — open the link in your inbox");
				return;
			}

			void authClient.getSession();
			onVerified();
			router.refresh();
		} catch (err) {
			console.error("[onboarding] verify check failed", err);
			toast.error("Could not check verification — try again");
		} finally {
			setRefreshing(false);
		}
	}

	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="Verify your email to rate films and pin favorites during setup."
				title="Verify your email"
			/>

			<div className="flex flex-col gap-3 rounded-2xl bg-background p-5 text-center lg:text-start">
				<p className="text-pretty text-foreground text-sm">
					We sent a link to{" "}
					<span className="font-medium">{userEmail || "your inbox"}</span>. Open
					it, then come back here.
				</p>
				<OnboardingSecondaryButton
					className="w-full"
					disabled={resending}
					nested
					onClick={() => void handleResend()}
				>
					{resending ? "Sending…" : "Resend email"}
				</OnboardingSecondaryButton>
				<OnboardingPrimaryButton
					className="w-full"
					disabled={refreshing}
					onClick={() => void handleVerified()}
				>
					{refreshing ? "Checking…" : "I've verified"}
				</OnboardingPrimaryButton>
			</div>
		</div>
	);
}
