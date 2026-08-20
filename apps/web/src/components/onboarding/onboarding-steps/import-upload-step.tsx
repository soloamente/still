"use client";

/**
 * Left-column upload step for onboarding import. Dropzones stay in the wizard.
 */

import {
	OnboardingPrimaryButton,
	OnboardingSecondaryButton,
} from "@/components/onboarding/onboarding-form-controls";
import { OnboardingStepHeader } from "@/components/onboarding/onboarding-steps/onboarding-step-header";
import type { OnboardingImportLiveSource } from "@/lib/onboarding-import-queue";

type ImportUploadStepProps = {
	source: OnboardingImportLiveSource;
	importDisabled: boolean;
	isImporting: boolean;
	onBack: () => void;
	onImport: () => void;
	onSkip: () => void;
};

/** Per-source title + description — exhaustive so a new live source fails compile. */
function importUploadCopy(source: OnboardingImportLiveSource): {
	title: string;
	description: string;
} {
	switch (source) {
		case "letterboxd":
			return {
				title: "Import from Letterboxd",
				description: "Upload the CSV files from your Letterboxd export folder.",
			};
		case "anilist":
			return {
				title: "Import from Anilist",
				description: "Upload your Anilist list JSON export.",
			};
		default: {
			const _exhaustive: never = source;
			return _exhaustive;
		}
	}
}

/**
 * Per-source upload copy + stacked actions only.
 * Letterboxd/Anilist dropzones mount in the wizard (Task 7), not here.
 */
export function ImportUploadStep({
	source,
	importDisabled,
	isImporting: _isImporting,
	onBack,
	onImport,
	onSkip,
}: ImportUploadStepProps) {
	const { title, description } = importUploadCopy(source);

	return (
		<div className="flex flex-col gap-8">
			<OnboardingStepHeader description={description} title={title} />
			<div className="flex flex-col gap-3">
				<OnboardingSecondaryButton
					className="w-full select-none"
					onClick={onBack}
				>
					Back
				</OnboardingSecondaryButton>
				<OnboardingPrimaryButton
					className="w-full select-none"
					disabled={importDisabled}
					onClick={onImport}
				>
					Import
				</OnboardingPrimaryButton>
				{/* Quiet skip — not a filled secondary, so Import never means skip. */}
				<button
					className="mx-auto cursor-pointer select-none bg-transparent px-3 py-2 font-medium text-muted-foreground text-sm [@media(hover:hover)]:hover:text-foreground"
					onClick={onSkip}
					type="button"
				>
					Skip for now
				</button>
			</div>
		</div>
	);
}
