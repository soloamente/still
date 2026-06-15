"use client";

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";

import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";

type WelcomeStepProps = {
	onProceed: () => void;
	onMaybeLater: () => void;
	isSkipping?: boolean;
};

/** Step 0 — set up now or abbreviated skip into name + handle only. */
export function WelcomeStep({
	onProceed,
	onMaybeLater,
	isSkipping = false,
}: WelcomeStepProps) {
	return (
		<div className="flex flex-col gap-12">
			<OnboardingStepHeader
				description="Complete your profile to join the community and share your taste."
				title="Let's set up your profile"
			/>

			<div className="flex flex-col gap-3">
				<OnboardingPrimaryButton className="w-full" onClick={onProceed}>
					Set up now
				</OnboardingPrimaryButton>
				<OnboardingSecondaryButton
					className="w-full"
					disabled={isSkipping}
					onClick={onMaybeLater}
				>
					{isSkipping ? "Okay, do it later then…" : "Maybe later"}
				</OnboardingSecondaryButton>
			</div>
		</div>
	);
}
