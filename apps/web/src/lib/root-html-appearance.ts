import { type AppThemeClass, isAppThemeLight } from "@/lib/app-themes";

/** Build `<html class>` so next/font vars and palette classes survive React hydration. */
export function buildRootHtmlClassName(
	fontClass: string,
	appTheme: AppThemeClass,
): string {
	const parts = fontClass.split(/\s+/).filter(Boolean);
	parts.push(appTheme);
	if (!isAppThemeLight(appTheme)) {
		parts.push("dark");
	}
	return parts.join(" ");
}

/** Apply palette to `<html>`. Merges font variables with theme classes after hydrate. */
export function applyAppearanceToDocument(
	fontClass: string,
	appTheme: AppThemeClass,
) {
	if (typeof document === "undefined") return;
	const root = document.documentElement;

	root.className = buildRootHtmlClassName(fontClass, appTheme);
	delete root.dataset.cinemaPreset;
	root.style.colorScheme = isAppThemeLight(appTheme) ? "light" : "dark";
}
