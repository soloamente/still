"use client";

import { cn } from "@still/ui/lib/utils";
import { QuotesSavedRow } from "@/components/quotes/quotes-saved-row";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import { QUOTES_SAVED_LOBBY_GRID_CLASSNAME } from "@/lib/quotes-lobby-layout";

/** Static fixtures for `/specs/quotes-saved-row` — no API. */
const QUOTES_SAVED_ROW_SPEC_FIXTURES: SavedQuoteLobbyItem[] = [
	{
		saveId: "spec-save-approved",
		savedAt: "2026-01-15T12:00:00.000Z",
		visibility: "public",
		quote: {
			id: "spec-quote-1",
			body: "There are certain things you can only realize from a great distance. Sometimes I'd failed to notice before I went away. Now that I'm back, I treasure it.",
			speaker: "Makoto Shinkai",
			timestampMs: 7_200_000,
			timestampLabel: "2:00:00",
			source: "patron",
			upvoteCount: 12,
			seasonNumber: null,
			episodeNumber: null,
		},
		listing: {
			kind: "movie",
			id: 10681,
			title: "Your Name.",
			posterPath: "/8YFL5QQVPy3AgrEQxNYVOgfkOG1.jpg",
			posterUrl:
				"https://image.tmdb.org/t/p/w342/8YFL5QQVPy3AgrEQxNYVOgfkOG1.jpg",
			year: 2016,
			seasonNumber: null,
			episodeNumber: null,
		},
		submission: {
			status: "approved",
			createdAt: "2025-11-01T00:00:00.000Z",
			reviewedAt: "2025-11-03T00:00:00.000Z",
		},
	},
	{
		saveId: "spec-save-private",
		savedAt: "2026-02-01T08:30:00.000Z",
		visibility: "private",
		quote: {
			id: "spec-quote-2",
			body: "I'm not a hero. I'm a high-functioning sociopath.",
			speaker: "Sherlock Holmes",
			timestampMs: null,
			timestampLabel: null,
			source: "external_api",
			upvoteCount: 4,
			seasonNumber: 1,
			episodeNumber: 1,
		},
		listing: {
			kind: "tv",
			id: 19885,
			title: "Sherlock",
			posterPath: "/7WT6XH72q2jG0AD7CbFYN3E1j2M.jpg",
			posterUrl:
				"https://image.tmdb.org/t/p/w342/7WT6XH72q2jG0AD7CbFYN3E1j2M.jpg",
			year: 2010,
			seasonNumber: 1,
			episodeNumber: 1,
		},
		submission: null,
	},
];

/** Dev-only layout preview for the saved quote row (Figma 3313 / 4523). */
export function QuotesSavedRowSpecSheet({
	theme,
}: {
	theme: "light" | "dark";
}) {
	const items = QUOTES_SAVED_ROW_SPEC_FIXTURES;

	return (
		<div
			className={cn(
				"min-h-svh bg-background px-4 py-10 text-foreground",
				theme === "dark" ? "dark" : "",
			)}
		>
			<div className="mx-auto mb-8 max-w-3xl text-center">
				<p className="font-semibold text-lg tracking-tight">
					Saved quote row spec
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Internal preview — visibility and pin controls call the API when used.
				</p>
			</div>
			<ul className={QUOTES_SAVED_LOBBY_GRID_CLASSNAME}>
				{items.map((item) => (
					<li key={item.saveId} className="min-w-0">
						<QuotesSavedRow item={item} />
					</li>
				))}
			</ul>
		</div>
	);
}
