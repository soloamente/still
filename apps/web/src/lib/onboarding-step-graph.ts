/** Back-navigation graph for Sense onboarding wizard steps. */
import type { WizardSkipMode, WizardStep } from "./onboarding-types";

/** Full-path beats for the rail progress fill (upload shares the import beat). */
const ONBOARDING_FULL_PROGRESS_TRACK = [
	"welcome",
	"avatar",
	"name",
	"handle",
	"bio",
	"verify",
	"taste",
	"favorites",
	"import",
	"done",
] as const satisfies readonly WizardStep[];

/** Maybe-later path is name + handle only. */
const ONBOARDING_ABBREV_PROGRESS_TRACK = [
	"welcome",
	"name",
	"handle",
] as const satisfies readonly WizardStep[];

/** Collapse upload onto import so the track stays one beat per chapter. */
function onboardingProgressTrackStep(step: WizardStep): WizardStep {
	switch (step) {
		case "import-upload":
			return "import";
		case "welcome":
		case "avatar":
		case "name":
		case "handle":
		case "bio":
		case "verify":
		case "taste":
		case "favorites":
		case "import":
		case "done":
			return step;
		default: {
			const unreachable: never = step;
			return unreachable;
		}
	}
}

/** 0–1 fill for the onboarding rail progress bar. */
export function onboardingProgressFraction(
	step: WizardStep,
	skipMode: WizardSkipMode,
): number {
	const track: readonly WizardStep[] =
		skipMode === "abbreviated"
			? ONBOARDING_ABBREV_PROGRESS_TRACK
			: ONBOARDING_FULL_PROGRESS_TRACK;
	const index = track.indexOf(onboardingProgressTrackStep(step));
	if (index < 0) return 0;
	const last = track.length - 1;
	if (last <= 0) return 1;
	return index / last;
}

export function previousOnboardingStep(
	current: WizardStep,
	skipMode: WizardSkipMode,
): WizardStep | null {
	if (current === "done" || current === "welcome" || current === "verify") {
		return null;
	}
	if (skipMode === "abbreviated") {
		if (current === "name") return "welcome";
		if (current === "handle") return "name";
		return null;
	}
	if (current === "avatar") return "welcome";
	if (current === "name") return "avatar";
	if (current === "handle") return "name";
	if (current === "bio") return "handle";
	if (current === "taste") return "bio";
	if (current === "favorites") return "taste";
	// Full path only: import sits after favorites; upload sits after the picker.
	if (current === "import") return "favorites";
	if (current === "import-upload") return "import";
	return null;
}

export function isOnboardingImportStep(step: WizardStep): boolean {
	return step === "import" || step === "import-upload";
}
