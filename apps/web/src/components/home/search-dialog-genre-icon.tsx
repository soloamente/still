"use client";

import {
	IconSearchDialogGenre,
	type SearchDialogGenreGlyphKey,
} from "@still/ui/icons/search-dialog-glyphs";
import { cn } from "@still/ui/lib/utils";
import type { SearchDialogGenreIconKey } from "@/lib/search-dialog-genre-icon";
import { searchDialogGenreIconKey } from "@/lib/search-dialog-genre-icon";

/** Leading mark for genre chips — Nucleo UI glyph @ 18px. */
export function SearchDialogGenreIcon({
	name,
	className,
}: {
	name: string;
	className?: string;
}) {
	const key = searchDialogGenreIconKey(name);
	// Tailwind `size-5` = 20px — match Nucleo UI glyph scale in recent pills.
	const pixelSize = className?.includes("size-5") ? 20 : 18;
	return (
		<IconSearchDialogGenre
			glyph={key as SearchDialogGenreGlyphKey}
			size={pixelSize}
			className={cn(className)}
		/>
	);
}
