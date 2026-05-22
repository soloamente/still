/**
 * Named shell palettes — single registry for Settings UI, CSS class names, and
 * server validation. Server mirrors ids + tier in `apps/server`.
 */

export const APP_THEME_CLASS_THEATER = "theme-theater" as const;

export const APP_THEME_CLASS_LOBBY_LIGHT = "theme-lobby-light" as const;

export const APP_THEME_CLASS_NOIR = "theme-noir" as const;

export type AppThemeClass =
	| typeof APP_THEME_CLASS_THEATER
	| typeof APP_THEME_CLASS_LOBBY_LIGHT
	| typeof APP_THEME_CLASS_NOIR;

export type AppThemeTier = "free" | "pro";

export type AppThemeDefinition = {
	/** `next-themes` class on `<html>`. */

	className: AppThemeClass;

	label: string;

	tier: AppThemeTier;

	/** Settings swatch preview (hex). */

	preview: { canvas: string; raised: string; accent: string };
};

export const APP_THEMES = {
	[APP_THEME_CLASS_THEATER]: {
		className: APP_THEME_CLASS_THEATER,

		label: "Theater",

		tier: "free",

		preview: {
			canvas: "oklch(0.2645 0 0)",

			raised: "oklch(0.2264 0 0)",

			accent: "#b75928",
		},
	},

	[APP_THEME_CLASS_LOBBY_LIGHT]: {
		className: APP_THEME_CLASS_LOBBY_LIGHT,

		label: "Lobby Light",

		tier: "free",

		preview: {
			canvas: "#f2f2f2",

			raised: "#ffffff",

			accent: "#b75928",
		},
	},

	[APP_THEME_CLASS_NOIR]: {
		className: APP_THEME_CLASS_NOIR,

		label: "Noir",

		tier: "free",

		preview: {
			canvas: "oklch(0.18 0.02 250)",

			raised: "oklch(0.14 0.02 250)",

			accent: "#9a4f2a",
		},
	},
} as const satisfies Record<AppThemeClass, AppThemeDefinition>;

export const APP_THEME_LIST = Object.values(APP_THEMES);

/** All palette class names on `<html>` — used when swapping themes on the document. */

export const APP_THEME_CLASS_NAMES: AppThemeClass[] = APP_THEME_LIST.map(
	(def) => def.className,
);

export const DEFAULT_APP_THEME_CLASS = APP_THEME_CLASS_THEATER;

/** `next-themes` localStorage key — keep in sync with `ThemeProvider` `storageKey`. */

export const STILL_APP_THEME_STORAGE_KEY = "still-app-theme";

const LEGACY_THEME_ALIASES: Record<string, AppThemeClass> = {
	dark: APP_THEME_CLASS_THEATER,

	light: APP_THEME_CLASS_LOBBY_LIGHT,

	system: APP_THEME_CLASS_THEATER,
};

export function isAppThemeClass(value: string): value is AppThemeClass {
	return value in APP_THEMES;
}

/** Maps stored prefs / legacy `next-themes` values to a palette class. */

export function resolveAppTheme(raw: unknown): AppThemeClass {
	if (typeof raw !== "string") return DEFAULT_APP_THEME_CLASS;

	if (isAppThemeClass(raw)) return raw;

	const alias = LEGACY_THEME_ALIASES[raw];

	if (alias) return alias;

	return DEFAULT_APP_THEME_CLASS;
}

export function isAppThemeLight(theme: AppThemeClass): boolean {
	return theme === APP_THEME_CLASS_LOBBY_LIGHT;
}

export function appThemeTier(theme: AppThemeClass): AppThemeTier {
	return APP_THEMES[theme].tier;
}
