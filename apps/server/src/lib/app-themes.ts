/**
 * Server-side theme registry — ids and Pro tier only (no web imports).
 */

export const APP_THEME_IDS = [
	"theme-theater",

	"theme-lobby-light",

	"theme-noir",
] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export type AppThemeTier = "free" | "pro";

const THEME_TIERS: Record<AppThemeId, AppThemeTier> = {
	"theme-theater": "free",

	"theme-lobby-light": "free",

	"theme-noir": "free",
};

export function isAppThemeId(value: unknown): value is AppThemeId {
	return (
		typeof value === "string" &&
		(APP_THEME_IDS as readonly string[]).includes(value)
	);
}

export function appThemeTier(themeId: AppThemeId): AppThemeTier {
	return THEME_TIERS[themeId];
}
