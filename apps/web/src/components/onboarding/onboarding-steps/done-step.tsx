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

/** Step 7 — celebration + taste reveal; patron chooses to edit or enter the app. */
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

			{/*
			  Taste signature as its own raised specimen — not a second muted
			  paragraph under the step description (those used to blend together).
			*/}
			{tasteHeadline ? (
				<aside
					aria-label="Your taste signature"
					className="rounded-2xl bg-background px-5 py-4 text-center sm:rounded-3xl sm:px-6 sm:py-5 lg:text-start"
				>
					<p className="font-medium text-[0.7rem] text-muted-foreground uppercase tracking-wider">
						Your taste
					</p>
					<p className="mt-2 text-pretty font-editorial text-base text-foreground leading-relaxed sm:text-[1.0625rem]">
						{tasteHeadline}
					</p>
				</aside>
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
