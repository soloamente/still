/** Pure helpers for onboarding import source selection and ordered queue. */
export const ONBOARDING_IMPORT_LIVE_SOURCES = [
	"letterboxd",
	"anilist",
] as const;
export const ONBOARDING_IMPORT_SOON_SOURCES = [
	"imdb",
	"trakt",
	"serializd",
	"tvtime",
] as const;

export type OnboardingImportLiveSource =
	(typeof ONBOARDING_IMPORT_LIVE_SOURCES)[number];
export type OnboardingImportSoonSource =
	(typeof ONBOARDING_IMPORT_SOON_SOURCES)[number];
export type OnboardingImportSourceId =
	| OnboardingImportLiveSource
	| OnboardingImportSoonSource;

export const ONBOARDING_IMPORT_SOURCE_LABEL: Record<
	OnboardingImportSourceId,
	string
> = {
	letterboxd: "Letterboxd",
	anilist: "Anilist",
	imdb: "IMDb",
	trakt: "Trakt",
	serializd: "Serializd",
	tvtime: "TV Time",
};
const LIVE_ORDER = ONBOARDING_IMPORT_LIVE_SOURCES;

export function isOnboardingImportLiveSource(
	id: string,
): id is OnboardingImportLiveSource {
	return (LIVE_ORDER as readonly string[]).includes(id);
}

export function buildOnboardingImportQueue(
	selected: Iterable<string>,
): OnboardingImportLiveSource[] {
	const picked = new Set<OnboardingImportLiveSource>();
	for (const id of selected) {
		if (isOnboardingImportLiveSource(id)) picked.add(id);
	}
	return LIVE_ORDER.filter((id) => picked.has(id));
}

export function toggleOnboardingImportLiveSource(
	selected: ReadonlySet<OnboardingImportLiveSource>,
	id: OnboardingImportLiveSource,
): Set<OnboardingImportLiveSource> {
	const next = new Set(selected);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	return next;
}
