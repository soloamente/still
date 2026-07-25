import { cn } from "@still/ui/lib/utils";

import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import {
	buildFestivalRecognitionListRows,
	type FestivalRecognitionListRow,
} from "@/lib/festival-recognition-lines";
import type { FestivalRecognitionEntry } from "@/lib/movie-festival-recognition";

/** Single festival award line — person-awards drawer parity (year + status pill). */
function FestivalAwardListRow({
	row,
	muted,
}: {
	row: FestivalRecognitionListRow;
	muted: boolean;
}) {
	const statusWord =
		row.status === "won"
			? "Won"
			: row.status === "nominated"
				? "Nominated"
				: null;
	// Prefer the category/note as the title; fall back to the festival body name.
	const primaryLabel = row.achievement ?? row.festivalTitle;
	const showFestivalSubtitle =
		row.achievement != null &&
		row.achievement.trim().toLowerCase() !==
			row.festivalTitle.trim().toLowerCase();

	return (
		<li
			className={cn(
				"flex items-start gap-3 sm:gap-4",
				muted ? "text-muted-foreground" : "text-foreground",
			)}
		>
			{/* Compact festival mark so rows stay list-height, not grid-column wide. */}
			<div className="flex shrink-0 items-center justify-center pt-0.5">
				<FestivalRecognitionIcon
					icon={row.icon}
					className="h-8 w-22 sm:h-9 sm:w-24"
				/>
			</div>
			<div className="min-w-0 flex-1 space-y-0.5">
				<p
					className={cn(
						"text-pretty font-semibold text-sm leading-snug sm:text-[0.9375rem]",
						muted ? "text-muted-foreground" : "text-foreground",
					)}
				>
					{primaryLabel}
				</p>
				{/* Year + status pill (canvas-on-card chip, same family as person awards). */}
				{row.year != null || statusWord != null ? (
					<div className="flex flex-wrap items-center gap-2">
						{row.year != null ? (
							<span
								className={cn(
									"font-medium text-xs tabular-nums leading-none sm:text-[0.8125rem]",
									muted ? "text-muted-foreground" : "text-foreground/80",
								)}
							>
								{row.year}
							</span>
						) : null}
						{statusWord != null ? (
							<span
								className={cn(
									"inline-flex items-center rounded-full bg-background px-2.5 py-0.5 font-medium text-[11px] tracking-wide",
									muted ? "text-muted-foreground" : "text-foreground",
								)}
							>
								{statusWord}
							</span>
						) : null}
					</div>
				) : null}
				{showFestivalSubtitle ? (
					<p
						className={cn(
							"truncate text-sm",
							muted ? "text-muted-foreground" : "text-foreground/90",
						)}
					>
						{row.festivalTitle}
					</p>
				) : null}
			</div>
		</li>
	);
}

/**
 * Flat awards catalogue for movie/TV View all drawer — wins first, then
 * status-less lines, then muted nominations (person awards drawer parity).
 */
export function FestivalRecognitionAwardList({
	entries,
	listingTitle,
}: {
	entries: FestivalRecognitionEntry[];
	listingTitle: string;
}) {
	const rows = buildFestivalRecognitionListRows(entries);
	if (!rows.length) return null;

	const wins = rows.filter((row) => row.status === "won");
	const other = rows.filter((row) => row.status === null);
	const nominations = rows.filter((row) => row.status === "nominated");

	return (
		<div className="flex flex-col gap-10">
			{wins.length > 0 ? (
				<ul
					className="flex flex-col gap-6"
					aria-label={`Awards won by ${listingTitle}`}
				>
					{wins.map((row) => (
						<FestivalAwardListRow key={row.id} row={row} muted={false} />
					))}
				</ul>
			) : null}

			{other.length > 0 ? (
				<ul
					className="flex flex-col gap-6"
					aria-label={`Festival recognition for ${listingTitle}`}
				>
					{other.map((row) => (
						<FestivalAwardListRow key={row.id} row={row} muted={false} />
					))}
				</ul>
			) : null}

			{nominations.length > 0 ? (
				<ul
					className="flex flex-col gap-6"
					aria-label={`Nominations for ${listingTitle}`}
				>
					{nominations.map((row) => (
						<FestivalAwardListRow key={row.id} row={row} muted />
					))}
				</ul>
			) : null}
		</div>
	);
}
