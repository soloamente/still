"use client";

import { useTheme } from "next-themes";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
} from "react";

import { useRootHtmlFontClass } from "@/components/app/root-html-font-class-context";
import { type AppThemeClass, resolveAppTheme } from "@/lib/app-themes";
import { readAppThemePref } from "@/lib/profile-preferences";
import { applyAppearanceToDocument } from "@/lib/root-html-appearance";

export type InitialAppearancePrefs = Record<string, unknown> | null | undefined;

type AppThemeShellContextValue = {
	applyThemeSelection: (nextTheme: AppThemeClass) => void;
};

const AppThemeShellContext = createContext<AppThemeShellContextValue | null>(
	null,
);

export function useAppThemeShell() {
	const ctx = useContext(AppThemeShellContext);
	if (!ctx) {
		throw new Error("useAppThemeShell must be used within AppThemeShell");
	}
	return ctx;
}

/** Hydrates palette from profile (signed-in) and keeps shadcn `.dark` in sync with `next-themes`. */
export function AppThemeShell({
	children,
	initialAppearance,
}: {
	children: ReactNode;
	initialAppearance?: InitialAppearancePrefs;
}) {
	const fontClass = useRootHtmlFontClass();
	const { theme, resolvedTheme, setTheme } = useTheme();
	const hydratedProfileRef = useRef(false);
	const hydratedClientRef = useRef(false);

	const profileTheme = useMemo(
		() => readAppThemePref(initialAppearance ?? null),
		[initialAppearance],
	);

	const syncDocument = useCallback(
		(appTheme: AppThemeClass) => {
			if (!fontClass) return;
			applyAppearanceToDocument(fontClass, appTheme);
		},
		[fontClass],
	);

	const applyThemeSelection = useCallback(
		(nextTheme: AppThemeClass) => {
			syncDocument(nextTheme);
			setTheme(nextTheme);
		},
		[setTheme, syncDocument],
	);

	// Signed-in: profile palette wins over stale guest storage once per session.
	useEffect(() => {
		if (hydratedProfileRef.current || initialAppearance == null) return;
		hydratedProfileRef.current = true;
		hydratedClientRef.current = true;
		syncDocument(profileTheme);
		setTheme(profileTheme);
	}, [initialAppearance, profileTheme, setTheme, syncDocument]);

	// Guest / first paint: once `next-themes` resolves storage, sync palette on `<html>`.
	useEffect(() => {
		if (hydratedClientRef.current || theme === undefined || !fontClass) return;
		hydratedClientRef.current = true;
		const active = resolveAppTheme(resolvedTheme ?? theme);
		syncDocument(active);
		setTheme(active);
	}, [fontClass, resolvedTheme, setTheme, syncDocument, theme]);

	const value = useMemo(
		() => ({
			applyThemeSelection,
		}),
		[applyThemeSelection],
	);

	return (
		<AppThemeShellContext.Provider value={value}>
			{children}
		</AppThemeShellContext.Provider>
	);
}
