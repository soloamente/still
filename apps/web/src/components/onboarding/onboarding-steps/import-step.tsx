"use client";

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";

import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";

type ImportStepProps = {
	onBack: () => void;
	onContinue: () => void;
	onNotNow: () => void;
	continueDisabled: boolean;
};

/**
 * Post-setup source picker — left copy + stacked actions only.
 * The source list lives in the right pane (and under this step on mobile).
 */
export function ImportStep({
	onBack,
	onContinue,
	onNotNow,
	continueDisabled,
}: ImportStepProps) {
	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="Import from Letterboxd or Anilist. You can skip this."
				title="Bring your diary with you"
			/>
			<div className="flex flex-col gap-3">
				<OnboardingSecondaryButton
					className="w-full select-none"
					onClick={onBack}
				>
					Back
				</OnboardingSecondaryButton>
				<OnboardingPrimaryButton
					className="w-full select-none"
					disabled={continueDisabled}
					onClick={onContinue}
				>
					Continue
				</OnboardingPrimaryButton>
				{/* Quiet skip — not a filled secondary, so Continue never means skip. */}
				<button
					className="mx-auto cursor-pointer select-none bg-transparent px-3 py-2 font-medium text-muted-foreground text-sm [@media(hover:hover)]:hover:text-foreground"
					onClick={onNotNow}
					type="button"
				>
					Not now
				</button>
			</div>
		</div>
	);
}
