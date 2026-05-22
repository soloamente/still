"use client";

import { Toaster } from "@still/ui/components/sonner";
import { RootHtmlClassSync } from "@/components/app/root-html-class-sync";
import { RootHtmlFontClassProvider } from "@/components/app/root-html-font-class-context";
import { CinemaSoundProvider } from "@/components/cinema/sound-provider";
import { LenisProvider } from "@/components/lenis-provider";
import {
	APP_THEME_CLASS_LOBBY_LIGHT,
	APP_THEME_CLASS_NOIR,
	APP_THEME_CLASS_THEATER,
	STILL_APP_THEME_STORAGE_KEY,
} from "@/lib/app-themes";

import { ThemeProvider } from "./theme-provider";

/**
 * Named palettes default to **Theater** (Aker dark). System maps OS light → Lobby
 * Light and OS dark → Theater. `disableTransitionOnChange` avoids token flash.
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
					"system",
				]}
				value={{
					light: APP_THEME_CLASS_LOBBY_LIGHT,
					dark: APP_THEME_CLASS_THEATER,
					/* next-themes only removes `Object.values(value)` — include every palette class. */
					[APP_THEME_CLASS_THEATER]: APP_THEME_CLASS_THEATER,
					[APP_THEME_CLASS_LOBBY_LIGHT]: APP_THEME_CLASS_LOBBY_LIGHT,
					[APP_THEME_CLASS_NOIR]: APP_THEME_CLASS_NOIR,
				}}
				enableSystem
				disableTransitionOnChange
			>
				{/* Lenis: smooth wheel / touch scroll on `window` — `root` avoids an extra scroll wrapper. */}
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
