import { cn } from "@still/ui/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/**
 * Maps persisted poster palette + genre fallback into CSS variables for the
 * movie page shell. When `palette*` are null (not synced yet), only
 * `--movie-accent` is driven by `genreAccent`; `.movie-themed` in `globals.css`
 * derives muted/foreground from accent via `color-mix`.
 */
export function MovieThemeProvider({
	genreAccent,
	paletteAccent,
	paletteMuted,
	paletteForeground,
	children,
}: {
	genreAccent: string;
	paletteAccent: string | null | undefined;
	paletteMuted: string | null | undefined;
	paletteForeground: string | null | undefined;
	children: ReactNode;
}) {
	const accent = paletteAccent ?? genreAccent;
	const style = {
		"--movie-accent": accent,
		...(paletteMuted ? { "--movie-accent-muted": paletteMuted } : {}),
		...(paletteForeground
			? { "--movie-accent-foreground": paletteForeground }
			: {}),
	} as CSSProperties;

	return (
		<div
			className={cn(
				"movie-themed",
				// Participate in `AppShell` `<main>` flex column so detail `bg-card` shells can `flex-1` to viewport height when content is short (e.g. Streaming tab).
				"flex min-h-0 flex-1 flex-col",
			)}
			style={style}
		>
			{children}
		</div>
	);
}
