"use client";

import { OnboardingFieldInput } from "@/components/onboarding/onboarding-form-controls";

import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";

type NameStepProps = {
	displayName: string;
	onDisplayNameChange: (value: string) => void;
	onFocus?: () => void;
	onBlur?: (value: string) => void;
	placeholder?: string;
};

/** Step 2 — display name shown on profile and in the feed. */
export function NameStep({
	displayName,
	onDisplayNameChange,
	onFocus,
	onBlur,
	placeholder = "Enter your name",
}: NameStepProps) {
	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="This is the name people will see on your profile."
				title="What's your name?"
			/>

			<OnboardingFieldInput
				autoComplete="name"
				onBlur={(e) => onBlur?.(e.target.value)}
				onChange={(e) => onDisplayNameChange(e.target.value)}
				onFocus={onFocus}
				placeholder={placeholder}
				spellCheck={false}
				value={displayName}
			/>
		</div>
	);
}
