"use client";

import { Toaster } from "@still/ui/components/sonner";
import { RootHtmlClassSync } from "@/components/app/root-html-class-sync";
import { RootHtmlFontClassProvider } from "@/components/app/root-html-font-class-context";
import { CinemaSoundProvider } from "@/components/cinema/sound-provider";
import { LenisProvider } from "@/components/lenis-provider";
import {
	APP_THEME_CLASS_EMBER,
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_MIDNIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
	STILL_APP_THEME_STORAGE_KEY,
} from "@/lib/app-themes";

import { ThemeProvider } from "./theme-provider";

/**
 * Named palettes default to **Calm** (`theme-theater`). System maps OS light →
 * **Lucid** and OS dark → **Calm**. `disableTransitionOnChange` avoids token flash.
 */
export default function Providers({
	children,
	htmlFontClass,
}: {
	children: React.ReactNode;
	/** next/font variable classes — must be merged onto `<html>` with palette classes. */
	htmlFontClass: string;
}) {
	return (
		<RootHtmlFontClassProvider fontClass={htmlFontClass}>
			<ThemeProvider
				attribute="class"
				defaultTheme={APP_THEME_CLASS_THEATER}
				storageKey={STILL_APP_THEME_STORAGE_KEY}
				themes={[
					APP_THEME_CLASS_THEATER,
					APP_THEME_CLASS_LOBBY_LIGHT,
					APP_THEME_CLASS_NOIR,
					APP_THEME_CLASS_EMBER,
					APP_THEME_CLASS_MIDNIGHT,
					"system",
				]}
				value={{
					light: APP_THEME_CLASS_LOBBY_LIGHT,
					dark: APP_THEME_CLASS_THEATER,
					/* next-themes only removes `Object.values(value)` — include every palette class. */
					[APP_THEME_CLASS_THEATER]: APP_THEME_CLASS_THEATER,
					[APP_THEME_CLASS_LOBBY_LIGHT]: APP_THEME_CLASS_LOBBY_LIGHT,
					[APP_THEME_CLASS_NOIR]: APP_THEME_CLASS_NOIR,
					[APP_THEME_CLASS_EMBER]: APP_THEME_CLASS_EMBER,
					[APP_THEME_CLASS_MIDNIGHT]: APP_THEME_CLASS_MIDNIGHT,
				}}
				enableSystem
				disableTransitionOnChange
			>
				{/* Lenis: opt-in smooth wheel via Settings; native scroll by default. */}
				<LenisProvider>
					{/* Theater audio persists via profile JSON but still hydrates lazily behind gestures. */}
					<RootHtmlClassSync />
					<CinemaSoundProvider>{children}</CinemaSoundProvider>
				</LenisProvider>
				{/* Pill chrome + chip helpers in `@still/ui`; toasts default to bottom-center. */}
				<Toaster position="bottom-center" />
			</ThemeProvider>
		</RootHtmlFontClassProvider>
	);
}
