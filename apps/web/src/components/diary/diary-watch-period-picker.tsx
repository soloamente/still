"use client";

import { cn } from "@still/ui/lib/utils";

import { useDiaryLobbyParams } from "@/components/diary/diary-lobby-params-context";
import {
	FilterChipRow,
	filterChipBaseClass,
} from "@/components/ui/filter-chip-row";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDiaryDecadeLabel } from "@/lib/diary-lobby-order";

function sectionLabel(text: string) {
	return (
		<p className="mb-2 px-0.5 font-medium text-muted-foreground text-xs tracking-wide">
			{text}
		</p>
	);
}

function periodChipClass(active: boolean) {
	return cn(
		filterChipBaseClass,
		"min-h-10 transition-[transform,color] duration-200 ease-out active:scale-[0.96] motion-reduce:transition-none",
		active
			? "bg-foreground/10 text-foreground"
			: cn("bg-card text-muted-foreground", DETAIL_CANVAS_ON_CARD_HOVER_CLASS),
	);
}

/**
 * Watch year / decade picks for the diary filters popover — filters via `?year=` /
 * `?decade=` on `watchedAt`, not release year.
 */
export function DiaryWatchPeriodPicker() {
	const {
		watchPeriods,
		year,
		decade,
		selectYear,
		selectDecade,
		clearWatchPeriod,
	} = useDiaryLobbyParams();

	const { years, decades } = watchPeriods;
	if (years.length === 0) return null;

	const periodActive = year != null || decade != null;

	return (
		<div className="flex flex-col gap-3">
			<div>
				{sectionLabel("When watched")}
				{decades.length > 0 ? (
					<FilterChipRow aria-label="Watch decades" className="mb-2 gap-1.5">
						{periodActive ? (
							<button
								type="button"
								className={periodChipClass(false)}
								aria-pressed={false}
								onClick={clearWatchPeriod}
							>
								All years
							</button>
						) : null}
						{decades.map((d) => {
							const active = decade === d && year == null;
							return (
								<button
									key={`decade-${d}`}
									type="button"
									className={periodChipClass(active)}
									aria-pressed={active}
									onClick={() => selectDecade(d)}
								>
									{formatDiaryDecadeLabel(d)}
								</button>
							);
						})}
					</FilterChipRow>
				) : null}
				<FilterChipRow aria-label="Watch years" className="gap-1.5">
					{decades.length === 0 && periodActive ? (
						<button
							type="button"
							className={periodChipClass(false)}
							aria-pressed={false}
							onClick={clearWatchPeriod}
						>
							All years
						</button>
					) : null}
					{years.map((y) => {
						const active = year === y;
						return (
							<button
								key={`year-${y}`}
								type="button"
								className={periodChipClass(active)}
								aria-pressed={active}
								onClick={() => selectYear(y)}
							>
								{y}
							</button>
						);
					})}
				</FilterChipRow>
			</div>
		</div>
	);
}
