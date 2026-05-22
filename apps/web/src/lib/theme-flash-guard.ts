import {
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_NAMES,
	APP_THEME_CLASS_THEATER,
	type AppThemeClass,
	DEFAULT_APP_THEME_CLASS,
	isAppThemeClass,
	STILL_APP_THEME_STORAGE_KEY,
} from "@/lib/app-themes";

/** Inline script: apply stored palette on `<html>` before first paint (avoids dark flash). */
export function buildThemeFlashGuardScript(): string {
	const themeList = JSON.stringify(APP_THEME_CLASS_NAMES);
	const storageKey = JSON.stringify(STILL_APP_THEME_STORAGE_KEY);
	const defaultTheme = JSON.stringify(DEFAULT_APP_THEME_CLASS);
	const lobbyLight = JSON.stringify(APP_THEME_CLASS_LOBBY_LIGHT);
	const theater = JSON.stringify(APP_THEME_CLASS_THEATER);

	return `(function(){try{var k=${storageKey},themes=${themeList},d=document.documentElement,t=localStorage.getItem(k);if(t==="light")t=${lobbyLight};else if(t==="dark")t=${theater};else if(t==="system")t=matchMedia("(prefers-color-scheme:dark)").matches?${theater}:${lobbyLight};else if(!themes.includes(t))t=${defaultTheme};d.classList.remove("dark");for(var i=0;i<themes.length;i++)d.classList.remove(themes[i]);d.classList.add(t);if(t!==${lobbyLight})d.classList.add("dark");d.style.colorScheme=t===${lobbyLight}?"light":"dark";}catch(e){}})();`;
}

/** Server-only: resolve theme class for SSR `className` on `<html>`. */
export function resolveThemeClassForSsr(raw: unknown): AppThemeClass {
	if (typeof raw !== "string") return DEFAULT_APP_THEME_CLASS;
	if (isAppThemeClass(raw)) return raw;
	if (raw === "light") return APP_THEME_CLASS_LOBBY_LIGHT;
	if (raw === "dark" || raw === "system") return APP_THEME_CLASS_THEATER;
	return DEFAULT_APP_THEME_CLASS;
}
