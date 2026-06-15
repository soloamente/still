"use client";

import { Label } from "@still/ui/components/label";

import { OnboardingFieldTextarea } from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import { ONBOARDING_BIO_MAX } from "@/lib/onboarding-types";

type BioStepProps = {
	bio: string;
	onBioChange: (value: string) => void;
};

/** Step 4 — optional profile bio (max 600 chars). */
export function BioStep({ bio, onBioChange }: BioStepProps) {
	const remaining = ONBOARDING_BIO_MAX - bio.length;

	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader
				description="Add a bio to help others get to know you better."
				title="Tell us about yourself"
			/>

			<div className="space-y-2">
				<Label className="sr-only" htmlFor="onboarding-bio">
					Bio
				</Label>
				<OnboardingFieldTextarea
					id="onboarding-bio"
					maxLength={ONBOARDING_BIO_MAX}
					onChange={(e) => onBioChange(e.target.value)}
					placeholder="Write a short bio about your taste…"
					value={bio}
				/>
				<p className="text-center text-muted-foreground text-xs tabular-nums">
					{remaining} characters left
				</p>
			</div>
		</div>
	);
}
