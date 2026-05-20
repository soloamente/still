import { cn } from "@still/ui/lib/utils";

import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import { MovieDetailBodySection } from "@/components/movie/movie-detail-body-section";
import { MOVIE_DETAIL_SECTION } from "@/lib/movie-detail-sections";
import {
	type FestivalRecognitionEntry,
	MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
} from "@/lib/movie-festival-recognition";

const YEAR_ONLY = /^\d{4}$/;

/** Pairs flat `[year, detail, …]` lines into one block per award. */
function groupFestivalDetailLines(
	lines: string[],
): Array<{ year: string | null; detail: string | null }> {
	const groups: Array<{ year: string | null; detail: string | null }> = [];
	let index = 0;

	while (index < lines.length) {
		const current = lines[index] ?? "";
		const next = lines[index + 1];
		const currentIsYear = YEAR_ONLY.test(current.trim());
		const nextIsDetail =
			next != null && next.length > 0 && !YEAR_ONLY.test(next.trim());

		if (currentIsYear && nextIsDetail) {
			groups.push({ year: current, detail: next });
			index += 2;
			continue;
		}

		if (currentIsYear) {
			groups.push({ year: current, detail: null });
			index += 1;
			continue;
		}

		groups.push({ year: null, detail: current });
		index += 1;
	}

	return groups;
}

/** Grid vs centered row — full 6-col grid only when we fill most of a large row. */
function festivalRecognitionListLayout(count: number): string {
	if (count === 1) {
		return "flex justify-center";
	}
	if (count < MOVIE_FESTIVAL_RECOGNITION_COLUMNS) {
		return cn(
			"grid w-fit max-w-full place-items-start",
			count === 2 && "grid-cols-2",
			count === 3 && "grid-cols-2 sm:grid-cols-3",
			count === 4 && "grid-cols-2 sm:grid-cols-4",
			count === 5 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
		);
	}
	return "grid w-full grid-cols-2 place-items-start sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6";
}

/**
 * Awards & festivals — MUBI-style row: icon, festival name, year then achievement on separate lines.
 */
export function MoviePremieresFestivals({
	entries,
}: {
	entries: FestivalRecognitionEntry[];
}) {
	if (!entries.length) return null;

	const displayEntries = entries.slice(
		0,
		MOVIE_FESTIVAL_RECOGNITION_DISPLAY_MAX,
	);
	const entryCount = displayEntries.length;
	const isSingleEntry = entryCount === 1;
	const isCompactRow = entryCount < MOVIE_FESTIVAL_RECOGNITION_COLUMNS;

	return (
		<MovieDetailBodySection
			id={MOVIE_DETAIL_SECTION.awards}
			title="Awards & festivals"
			className={cn(
				"pt-2 pb-2 sm:pt-4",
				"lg:left-1/2 lg:w-[min(100vw-2rem,96rem)] lg:max-w-none lg:-translate-x-1/2",
				"xl:w-[min(100vw-3rem,108rem)]",
			)}
		>
			{/* Up to 12 columns — six per row on `lg+`, wrapping to a second row instead of horizontal scroll. */}
			<div className="relative px-3 pt-1 pb-2 sm:px-5">
				<ul
					className={cn(
						"mx-auto gap-x-6 gap-y-10 sm:gap-x-8 lg:gap-x-10 lg:gap-y-12",
						festivalRecognitionListLayout(entryCount),
					)}
					aria-label="Festival and award recognition"
				>
					{displayEntries.map((entry) => (
						<li
							key={entry.id}
							className={cn(
								"flex min-w-0 flex-col items-center gap-2.5 overflow-visible text-center sm:gap-2",
								isSingleEntry || isCompactRow
									? "w-36 max-w-44 sm:w-40 sm:max-w-48"
									: "w-full",
							)}
						>
							<div className="flex min-h-11 w-full items-center justify-center overflow-visible sm:min-h-12">
								<FestivalRecognitionIcon icon={entry.icon} />
							</div>
							<h3 className="w-full text-balance font-semibold text-foreground text-sm leading-snug sm:text-[0.9375rem]">
								{entry.title}
							</h3>
							{entry.lines.length ? (
								<ul className="w-full space-y-1">
									{groupFestivalDetailLines(entry.lines).map((group) => (
										<li
											key={`${entry.id}:${group.year ?? ""}:${group.detail ?? ""}`}
											className="text-pretty text-muted-foreground text-xs leading-relaxed sm:text-[0.8125rem]"
										>
											{group.year ? (
												<span className="block font-medium text-foreground/80 tabular-nums">
													{group.year}
												</span>
											) : null}
											{group.detail ? (
												<span className="block leading-tight">
													{group.detail}
												</span>
											) : null}
										</li>
									))}
								</ul>
							) : null}
						</li>
					))}
				</ul>
			</div>
		</MovieDetailBodySection>
	);
}
