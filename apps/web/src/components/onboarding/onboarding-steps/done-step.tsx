"use client";

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { APP_NAME } from "@/lib/app-brand";

type DoneStepProps = {
	tasteHeadline: string | null;
	onEditProfile: () => void;
	onEnterApp: () => void;
	isEntering?: boolean;
};

/** Step 7 — celebration + final preview; patron chooses to edit or enter the app. */
export function DoneStep({
	tasteHeadline,
	onEditProfile,
	onEnterApp,
	isEntering = false,
}: DoneStepProps) {
	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="Your profile is saved — take a last look, or head in when you're ready."
				title="You made it"
			/>

			{tasteHeadline ? (
				<p className="mx-auto max-w-md text-pretty text-center font-editorial text-muted-foreground text-sm leading-relaxed">
					{tasteHeadline}
				</p>
			) : null}

			<div className="flex flex-col gap-3">
				<OnboardingPrimaryButton
					className="w-full"
					disabled={isEntering}
					onClick={onEnterApp}
				>
					{isEntering ? "Opening…" : `Enter ${APP_NAME}`}
				</OnboardingPrimaryButton>
				<OnboardingSecondaryButton
					className="w-full"
					disabled={isEntering}
					onClick={onEditProfile}
				>
					Edit profile
				</OnboardingSecondaryButton>
			</div>
		</div>
	);
}
