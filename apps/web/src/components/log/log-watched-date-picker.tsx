"use client";

import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@still/ui/components/popover";
import { cn } from "@still/ui/lib/utils";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	buildWatchedDateMonthGrid,
	defaultBirthDatePickerAnchorYmd,
	formatMonthLabel,
	formatMonthShortLabel,
	formatTodayYmd,
	formatWatchedDateLabel,
	getWeekdayLabels,
	isValidYmd,
	isWatchedDateMonthSelectable,
	listWatchedDatePickerYears,
	WATCHED_DATE_MONTH_INDICES,
	ymdToLocalDate,
} from "@/lib/log-watched-date";

const triggerClass =
	"flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-2xl border-transparent bg-background px-3.5 py-2 text-left text-base text-foreground shadow-none outline-none transition-colors duration-200 ease-out [@media(hover:hover)]:hover:bg-foreground/10 focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

const dayButtonClass =
	"inline-flex size-9 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none";

const headerIconButtonClass =
	"inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none";

const headerChipClass =
	"inline-flex min-h-9 max-w-[7.5rem] min-w-0 items-center justify-center rounded-full px-2.5 font-medium text-foreground text-sm tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none";

const panelPickButtonClass =
	"inline-flex min-h-9 items-center justify-center rounded-full px-2 font-medium text-sm tabular-nums transition-colors duration-200 ease-out motion-reduce:transition-none";

type CalendarPanelView = "days" | "months" | "years";

interface LogWatchedDatePickerProps {
	id: string;
	value: string;
	onChange: (ymd: string) => void;
	/** When true, an empty value shows {@link emptyPlaceholder} instead of defaulting to today. */
	allowEmpty?: boolean;
	emptyPlaceholder?: string;
	/** Hide the quick “Today” shortcut (birth-date flows). */
	hideTodayShortcut?: boolean;
	popoverSide?: "top" | "bottom" | "left" | "right";
	/** Raise calendar popover above portaled modals (`APP_MODAL_POPOVER_POSITIONER_CLASS`). */
	popoverPositionerClassName?: string;
}

/**
 * Watched-on control for the quick-log sheet — Mobbin-style field trigger + custom calendar popover.
 */
export function LogWatchedDatePicker({
	id,
	value,
	onChange,
	allowEmpty = false,
	emptyPlaceholder = "Pick a date",
	hideTodayShortcut = false,
	popoverSide = "top",
	popoverPositionerClassName,
}: LogWatchedDatePickerProps) {
	const monthGridId = useId();
	const selectedYearRef = useRef<HTMLButtonElement | null>(null);
	const [open, setOpen] = useState(false);
	const [panelView, setPanelView] = useState<CalendarPanelView>("days");
	const maxYmd = formatTodayYmd();
	const hasValue = isValidYmd(value);
	const selected = hasValue ? value : maxYmd;
	const gridSelectedYmd = hasValue ? value : "";
	const selectedDate = ymdToLocalDate(selected);
	const maxDate = ymdToLocalDate(maxYmd);

	const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
	const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

	useEffect(() => {
		if (!open) {
			setPanelView("days");
			return;
		}
		if (allowEmpty && !hasValue) {
			const anchor = ymdToLocalDate(defaultBirthDatePickerAnchorYmd(maxYmd));
			setViewYear(anchor.getFullYear());
			setViewMonth(anchor.getMonth());
			return;
		}
		const d = ymdToLocalDate(selected);
		setViewYear(d.getFullYear());
		setViewMonth(d.getMonth());
	}, [allowEmpty, hasValue, open, selected, maxYmd]);

	useEffect(() => {
		if (!open || panelView !== "years") return;
		selectedYearRef.current?.scrollIntoView({ block: "center" });
	}, [open, panelView]);

	const cells = useMemo(
		() =>
			buildWatchedDateMonthGrid(viewYear, viewMonth, gridSelectedYmd, maxYmd),
		[viewYear, viewMonth, gridSelectedYmd, maxYmd],
	);

	const weekdayLabels = getWeekdayLabels();
	const pickerYears = useMemo(
		() => listWatchedDatePickerYears(maxYmd),
		[maxYmd],
	);

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

	function selectMonth(month: number) {
		setViewMonth(month);
		setPanelView("days");
	}

	function selectYear(year: number) {
		setViewYear(year);
		if (year === maxDate.getFullYear() && viewMonth > maxDate.getMonth()) {
			setViewMonth(maxDate.getMonth());
		}
		setPanelView("months");
	}

	const canGoNext =
		viewYear < maxDate.getFullYear() ||
		(viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());

	const showMonthNav = panelView === "days";

	return (
		<Popover open={open} onOpenChange={setOpen} modal={false}>
			<PopoverTrigger
				id={id}
				type="button"
				className={cn(triggerClass, DETAIL_CANVAS_ON_CARD_HOVER_CLASS)}
				aria-haspopup="dialog"
				aria-expanded={open}
			>
				<span
					className={cn(
						"truncate tabular-nums",
						allowEmpty && !hasValue && "text-muted-foreground",
					)}
				>
					{hasValue ? formatWatchedDateLabel(value) : emptyPlaceholder}
				</span>
				<Calendar
					className="size-4 shrink-0 text-muted-foreground"
					aria-hidden
				/>
			</PopoverTrigger>
			<PopoverContent
				side={popoverSide}
				align="center"
				sideOffset={10}
				positionMethod="fixed"
				positionerClassName={popoverPositionerClassName}
				initialFocus={false}
				className="w-[min(100vw-2rem,20rem)] rounded-[1.75rem] p-4 shadow-mobbin-xl"
			>
				<div className="mb-3 flex items-center justify-between gap-1">
					{showMonthNav ? (
						<button
							type="button"
							className={cn(
								headerIconButtonClass,
								DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
							aria-label="Previous month"
							onClick={() => shiftMonth(-1)}
						>
							<ChevronLeft className="size-4" aria-hidden />
						</button>
					) : (
						<button
							type="button"
							className={cn(
								headerIconButtonClass,
								DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
							aria-label={
								panelView === "years" ? "Back to months" : "Back to days"
							}
							onClick={() =>
								setPanelView(panelView === "years" ? "months" : "days")
							}
						>
							<ChevronLeft className="size-4" aria-hidden />
						</button>
					)}

					<div className="flex min-w-0 flex-1 items-center justify-center gap-1">
						{panelView === "years" ? (
							<p className="font-medium text-foreground text-sm">Pick year</p>
						) : (
							<>
								<button
									type="button"
									className={cn(
										headerChipClass,
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									aria-label={`Choose month, ${formatMonthLabel(viewMonth)}`}
									onClick={() => setPanelView("months")}
								>
									<span className="truncate">
										{panelView === "months"
											? formatMonthLabel(viewMonth)
											: formatMonthShortLabel(viewMonth)}
									</span>
								</button>
								<button
									type="button"
									className={cn(
										headerChipClass,
										DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
									)}
									aria-label={`Choose year, ${viewYear}`}
									onClick={() => setPanelView("years")}
								>
									{viewYear}
								</button>
							</>
						)}
					</div>

					{showMonthNav ? (
						<button
							type="button"
							disabled={!canGoNext}
							className={cn(
								headerIconButtonClass,
								"disabled:pointer-events-none disabled:opacity-40",
								canGoNext && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
							)}
							aria-label="Next month"
							onClick={() => shiftMonth(1)}
						>
							<ChevronRight className="size-4" aria-hidden />
						</button>
					) : (
						<span className="size-9 shrink-0" aria-hidden />
					)}
				</div>

				{panelView === "days" ? (
					<>
						<div className="mb-1 grid grid-cols-7 gap-0.5">
							{weekdayLabels.map((day) => (
								<span
									key={day.id}
									className="inline-flex size-9 items-center justify-center font-medium text-muted-foreground/80 text-xs"
									aria-hidden
								>
									{day.label}
								</span>
							))}
						</div>

						<section
							className="grid grid-cols-7 gap-0.5"
							aria-labelledby={monthGridId}
						>
							<p id={monthGridId} className="sr-only">
								{formatMonthLabel(viewMonth)} {viewYear}
							</p>
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
										cell.isToday &&
											!cell.isSelected &&
											"ring-1 ring-foreground/20",
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

						{hideTodayShortcut ? null : (
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
						)}
					</>
				) : null}

				{panelView === "months" ? (
					<div
						className="grid grid-cols-3 gap-1"
						role="listbox"
						aria-label="Choose month"
					>
						{WATCHED_DATE_MONTH_INDICES.map((month) => {
							const selectable = isWatchedDateMonthSelectable(
								viewYear,
								month,
								maxYmd,
							);
							const active = month === viewMonth;
							return (
								<button
									key={`watched-month-${month}`}
									type="button"
									role="option"
									disabled={!selectable}
									aria-selected={active}
									className={cn(
										panelPickButtonClass,
										"px-1",
										active && "bg-foreground text-background",
										!active && selectable && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										!selectable &&
											"cursor-not-allowed text-muted-foreground/30",
									)}
									onClick={() => selectMonth(month)}
								>
									{formatMonthShortLabel(month)}
								</button>
							);
						})}
					</div>
				) : null}

				{panelView === "years" ? (
					<div
						className="scrollbar-none max-h-52 overflow-y-auto overscroll-y-contain"
						role="listbox"
						aria-label="Choose year"
					>
						<div className="grid grid-cols-3 gap-1 px-0.5 pb-1">
							{pickerYears.map((year) => {
								const active = year === viewYear;
								return (
									<button
										key={year}
										ref={active ? selectedYearRef : undefined}
										type="button"
										role="option"
										aria-selected={active}
										className={cn(
											panelPickButtonClass,
											active && "bg-foreground text-background",
											!active && DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
										)}
										onClick={() => selectYear(year)}
									>
										{year}
									</button>
								);
							})}
						</div>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}
