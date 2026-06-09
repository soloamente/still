import {
	APP_THEME_CLASS_EMBER,
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_MIDNIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
	type AppThemeClass,
	DEFAULT_APP_THEME_CLASS,
} from "@/lib/app-themes";

/**
 * TMDb company id → `public/studios/{slug}/` folder name.
 * Add a row when a new themed logo set ships under `apps/web/public/studios/`.
 */
export const SEARCH_DIALOG_STUDIO_ASSET_SLUGS: Readonly<
	Partial<Record<number, string>>
> = {
	41077: "a24",
	90733: "neon",
	10146: "focus",
	34: "sony",
	3172: "blumhouse",
	13184: "annapurna",
};

/** File suffix after `{slug}_` — patron-facing palette label (Calm → `theater`, Lucid → `lucid`, …). */
export const APP_THEME_STUDIO_LOGO_SUFFIX: Readonly<
	Record<AppThemeClass, string>
> = {
	[APP_THEME_CLASS_THEATER]: "theater",
	[APP_THEME_CLASS_LOBBY_LIGHT]: "lucid",
	[APP_THEME_CLASS_NOIR]: "pensive",
	[APP_THEME_CLASS_EMBER]: "cozy",
	[APP_THEME_CLASS_MIDNIGHT]: "dreamy",
};

/** Public URL for a baked theme tile, e.g. `/studios/a24/a24_theater.png`. */
export function studioThemedLogoPath(
	slug: string,
	appTheme: AppThemeClass = DEFAULT_APP_THEME_CLASS,
): string {
	const suffix =
		APP_THEME_STUDIO_LOGO_SUFFIX[appTheme] ??
		APP_THEME_STUDIO_LOGO_SUFFIX[DEFAULT_APP_THEME_CLASS];
	return `/studios/${slug}/${slug}_${suffix}.png`;
}

/** Theme tile when we host assets; otherwise null (caller falls back to TMDb `logo_url`). */
export function resolveStudioThemedLogoUrl(
	studioId: number,
	appTheme: AppThemeClass = DEFAULT_APP_THEME_CLASS,
): string | null {
	const slug = SEARCH_DIALOG_STUDIO_ASSET_SLUGS[studioId];
	if (!slug) return null;
	return studioThemedLogoPath(slug, appTheme);
}

/** True when the rail/pill can show a hosted tile and/or a TMDb fallback logo. */
export function searchDialogStudioHasLogo(
	studioId: number,
	fallbackLogoUrl: string | null | undefined,
): boolean {
	return Boolean(SEARCH_DIALOG_STUDIO_ASSET_SLUGS[studioId] || fallbackLogoUrl);
}
