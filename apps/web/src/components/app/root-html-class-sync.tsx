"use client";

import { useTheme } from "next-themes";
import { useLayoutEffect, useRef } from "react";

import { useRootHtmlFontClass } from "@/components/app/root-html-font-class-context";
import { DEFAULT_APP_THEME_CLASS, resolveAppTheme } from "@/lib/app-themes";
import { applyAppearanceToDocument } from "@/lib/root-html-appearance";

/**
 * Re-applies palette classes on `<html>` after React hydrates the root layout.
 * Without this, font `className` from the server wins and strips `theme-*` / `.dark`.
 */
export function RootHtmlClassSync() {
	const fontClass = useRootHtmlFontClass();
	const { theme, resolvedTheme } = useTheme();
	const lastAppliedRef = useRef<string | null>(null);

	useLayoutEffect(() => {
		if (!fontClass || theme === undefined) return;

		const appTheme = resolveAppTheme(
			resolvedTheme ?? theme ?? DEFAULT_APP_THEME_CLASS,
		);
		const signature = `${fontClass}|${appTheme}`;
		if (lastAppliedRef.current === signature) return;
		lastAppliedRef.current = signature;

		applyAppearanceToDocument(fontClass, appTheme);
	}, [fontClass, resolvedTheme, theme]);

	return null;
}
