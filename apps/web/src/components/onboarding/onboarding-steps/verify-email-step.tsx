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

type VerifyEmailStepProps = {
	userEmail: string;
};

/**
 * Gate before quick-rate — diary logs require a verified email when public.
 * Patrons can resend and refresh after clicking the inbox link.
 */
export function VerifyEmailStep({ userEmail }: VerifyEmailStepProps) {
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
			router.refresh();
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

			<div className="flex flex-col gap-3 rounded-2xl bg-background p-5 text-center">
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
