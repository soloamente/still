import { cn } from "@still/ui/lib/utils";

import { FestivalRecognitionIcon } from "@/components/movie/festival-recognition-icon";
import type { FestivalRecognitionEntry } from "@/lib/movie-festival-recognition";

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

/**
 * Flex wrap keeps partial second rows centered (e.g. 7–11 entries under the 6-column cap).
 * Fixed-width columns still pack ~6 per row on large viewports without left-aligned leftovers.
 */
function festivalRecognitionListLayout(count: number): string {
	if (count === 1) {
		return "flex justify-center";
	}
	return "flex flex-wrap justify-center";
}

/** MUBI-style festival / award column grid — shared by About section and awards drawer. */
export function FestivalRecognitionGrid({
	entries,
	className,
	itemClassName,
}: {
	entries: FestivalRecognitionEntry[];
	className?: string;
	itemClassName?: string;
}) {
	if (!entries.length) return null;

	return (
		<ul
			className={cn(
				"mx-auto gap-x-6 gap-y-10 sm:gap-x-8 lg:gap-x-10 lg:gap-y-12",
				festivalRecognitionListLayout(entries.length),
				className,
			)}
			aria-label="Festival and award recognition"
		>
			{entries.map((entry) => (
				<li
					key={entry.id}
					className={cn(
						"flex w-36 min-w-0 max-w-44 flex-col items-center gap-2.5 overflow-visible text-center sm:w-40 sm:max-w-48 sm:gap-2",
						itemClassName,
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
										<span className="block leading-tight">{group.detail}</span>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</li>
			))}
		</ul>
	);
}
