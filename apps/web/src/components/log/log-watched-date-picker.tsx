"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	buildWatchedDateMonthGrid,
	formatMonthYearLabel,
	formatTodayYmd,
	formatWatchedDateLabel,
	getWeekdayLabels,
	isValidYmd,
	ymdToLocalDate,
} from "@/lib/log-watched-date";

const triggerClass =
	"flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-2xl border-transparent bg-background px-3.5 py-2 text-left text-base text-foreground shadow-none outline-none transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-foreground/10 focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

const dayButtonClass =
	"inline-flex size-9 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none";

interface LogWatchedDatePickerProps {
	id: string;
	value: string;
	onChange: (ymd: string) => void;
}

/**
 * Watched-on control for the quick-log sheet — Mobbin-style field trigger + custom calendar popover.
 */
export function LogWatchedDatePicker({
	id,
	value,
	onChange,
}: LogWatchedDatePickerProps) {
	const monthGridId = useId();
	const [open, setOpen] = useState(false);
	const maxYmd = formatTodayYmd();
	const selected = isValidYmd(value) ? value : maxYmd;
	const selectedDate = ymdToLocalDate(selected);

	const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
	const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

	useEffect(() => {
		if (!open) return;
		const d = ymdToLocalDate(selected);
		setViewYear(d.getFullYear());
		setViewMonth(d.getMonth());
	}, [open, selected]);

	const cells = useMemo(
		() => buildWatchedDateMonthGrid(viewYear, viewMonth, selected, maxYmd),
		[viewYear, viewMonth, selected, maxYmd],
	);

	const weekdayLabels = getWeekdayLabels();
	const monthLabel = formatMonthYearLabel(viewYear, viewMonth);

	function shiftMonth(delta: number) {
		const d = new Date(viewYear, viewMonth + delta, 1, 12, 0, 0);
		setViewYear(d.getFullYear());
		setViewMonth(d.getMonth());
	}

	function selectDay(ymd: string) {
		onChange(ymd);
		setOpen(false);
	}

	function selectToday() {
		onChange(maxYmd);
		setOpen(false);
	}

	const canGoNext =
		viewYear < ymdToLocalDate(maxYmd).getFullYear() ||
		(viewYear === ymdToLocalDate(maxYmd).getFullYear() &&
			viewMonth < ymdToLocalDate(maxYmd).getMonth());

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				id={id}
				type="button"
				className={cn(triggerClass, DETAIL_CANVAS_ON_CARD_HOVER_CLASS)}
				aria-haspopup="dialog"
				aria-expanded={open}
			>
				<span className="truncate tabular-nums">
					{formatWatchedDateLabel(selected)}
				</span>
				<Calendar
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={10}
				initialFocus={false}
				className="w-[min(100vw-2rem,20rem)] rounded-[1.75rem] p-4 shadow-mobbin-xl"
			>
				<div className="mb-3 flex items-center justify-between gap-2">
					<button
						type="button"
						className={cn(
							"inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						aria-label="Previous month"
						onClick={() => shiftMonth(-1)}
					>
						<ChevronLeft className="size-4" aria-hidden />
					</button>
					<p
						id={monthGridId}
						className="min-w-0 flex-1 text-center font-medium text-foreground text-sm tabular-nums"
					>
						{monthLabel}
					</p>
					<button
						type="button"
						disabled={!canGoNext}
						className={cn(
							"inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-out disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none",
							canGoNext && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						aria-label="Next month"
						onClick={() => shiftMonth(1)}
					>
						<ChevronRight className="size-4" aria-hidden />
					</button>
				</div>

				<div className="mb-1 grid grid-cols-7 gap-0.5">
					{weekdayLabels.map((label) => (
						<span
							key={label}
							className="inline-flex size-9 items-center justify-center font-medium text-muted-foreground/80 text-xs"
							aria-hidden
						>
							{label}
						</span>
					))}
				</div>

				<section
					className="grid grid-cols-7 gap-0.5"
					aria-labelledby={monthGridId}
				>
					{cells.map((cell) => (
						<button
							key={cell.ymd}
							type="button"
							disabled={cell.isDisabled}
							aria-label={formatWatchedDateLabel(cell.ymd)}
							aria-pressed={cell.isSelected}
							aria-current={cell.isToday ? "date" : undefined}
							className={cn(
								dayButtonClass,
								!cell.inCurrentMonth && "text-muted-foreground/45",
								cell.inCurrentMonth &&
									!cell.isSelected &&
									!cell.isDisabled &&
									"text-foreground",
								cell.isToday && !cell.isSelected && "ring-1 ring-foreground/20",
								cell.isSelected && "bg-foreground text-background",
								!cell.isSelected &&
									!cell.isDisabled &&
									DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
								cell.isDisabled &&
									"cursor-not-allowed text-muted-foreground/30",
							)}
							onClick={() => selectDay(cell.ymd)}
						>
							{cell.day}
						</button>
					))}
				</section>

				<div className="mt-3 flex justify-center">
					<button
						type="button"
						className={cn(
							"inline-flex min-h-9 items-center justify-center rounded-full px-4 font-medium text-muted-foreground text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
							DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
						)}
						onClick={selectToday}
					>
						Today
					</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
