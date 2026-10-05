import {
	logoDevCompanyNameLogoUrl,
	logoDevDomainLogoUrl,
	logoDevPublishableKeyConfigured,
} from "@/lib/logo-dev-company-logo-url";

/** Optional domain overrides — sharper than name lookup for curated rail studios. */
const SEARCH_DIALOG_STUDIO_LOGO_DEV_DOMAINS: Readonly<
	Partial<Record<number, string>>
> = {
	41077: "a24films.com",
	90733: "neon.com",
	10146: "focusfeatures.com",
	34: "sonypictures.com",
	3172: "blumhouse.com",
	13184: "annapurnapics.com",
	429: "searchlightpictures.com",
	2: "disney.com",
	420: "marvel.com",
	127928: "20thcenturystudios.com",
	128064: "warnerbros.com",
	33: "universalpictures.com",
	4: "paramount.com",
	5: "columbiapictures.com",
	491: "lionsgate.com",
	213004: "netflix.com",
	20580: "amazon.com",
	148495: "apple.com",
	923: "legendary.com",
	5391: "illumination.com",
	10342: "ghibli.jp",
	5035: "criterion.com",
	11586: "gaumont.com",
	120526: "cj.net",
};

export type SearchDialogStudioPillLogoDevSize =
	| "pillCompact"
	| "pill"
	| "pillRecent"
	| "pillTiny"
	| "pillDialog"
	| "suggestion";

const PILL_LOGO_DEV_PIXELS: Record<SearchDialogStudioPillLogoDevSize, number> =
	{
		pillCompact: 18,
		pill: 20,
		pillRecent: 28,
		pillTiny: 32,
		pillDialog: 28,
		suggestion: 36,
	};

/** Search pill + history chips — Logo.dev JPG includes a light logo plate (not transparent PNG). */
export function searchDialogStudioPillLogoDevUrl(input: {
	studioId: number;
	studioName: string;
	size: SearchDialogStudioPillLogoDevSize;
}): string | null {
	if (!logoDevPublishableKeyConfigured()) return null;

	const pixels = PILL_LOGO_DEV_PIXELS[input.size];
	const opts = {
		width: pixels,
		height: pixels,
		format: "jpg" as const,
		theme: "auto" as const,
		retina: true,
		fallback: "monogram" as const,
	};

	const domain = SEARCH_DIALOG_STUDIO_LOGO_DEV_DOMAINS[input.studioId];
	if (domain) {
		const byDomain = logoDevDomainLogoUrl(domain, opts);
		if (byDomain) return byDomain;
	}

	const name = input.studioName.trim();
	if (!name) return null;
	return logoDevCompanyNameLogoUrl(name, opts);
}

export function searchDialogStudioPillUsesLogoDev(
	variant: SearchDialogStudioPillLogoDevSize | string,
): variant is SearchDialogStudioPillLogoDevSize {
	return variant in PILL_LOGO_DEV_PIXELS;
}

/** Whether a named studio can show a Logo.dev pill mark when the publishable key is set. */
export function searchDialogStudioLogoDevAvailable(
	studioName: string | null | undefined,
): boolean {
	if (!logoDevPublishableKeyConfigured()) return false;
	return Boolean(studioName?.trim());
}
