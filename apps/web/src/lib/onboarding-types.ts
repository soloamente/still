/** Wizard steps for Sense onboarding v3. */
export type WizardStep =
	| "welcome"
	| "avatar"
	| "name"
	| "handle"
	| "bio"
	| "verify"
	| "taste"
	| "favorites"
	| "import"
	| "import-upload"
	| "done";

/** Abbreviated skip path after “Maybe later”. */
export type WizardSkipMode = "full" | "abbreviated";

export type OnboardingMovie = {
	id: number;
	title: string;
	poster_url: string | null;
};

export const ONBOARDING_TASTE_MIN_RATED = 8;
/** Favorites are optional — 0 is fine; `ONBOARDING_FAVORITES_MAX` is a cap only. */
export const ONBOARDING_FAVORITES_MIN = 0;
export const ONBOARDING_FAVORITES_MAX = 8;
export const ONBOARDING_BIO_MAX = 600;
