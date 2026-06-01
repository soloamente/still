/** Local calendar `YYYY-MM-DD` for diary watched dates (no UTC slice). */

export function formatTodayYmd(): string {
	const d = new Date();
	return dateToYmd(d);
}

export function dateToYmd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function ymdToLocalDate(ymd: string): Date {
	return new Date(`${ymd}T12:00:00`);
}

export function isValidYmd(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const d = ymdToLocalDate(value);
	return !Number.isNaN(d.getTime());
}

/** Human label for the sheet trigger (e.g. "May 19, 2026"). */
export function formatWatchedDateLabel(ymd: string): string {
	if (!isValidYmd(ymd)) return "Pick a date";
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(ymdToLocalDate(ymd));
}

export function formatMonthYearLabel(year: number, month: number): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(year, month, 1, 12, 0, 0));
}

export function formatMonthLabel(month: number): string {
	return new Intl.DateTimeFormat("en-US", { month: "long" }).format(
		new Date(2020, month, 1, 12, 0, 0),
	);
}

export function formatMonthShortLabel(month: number): string {
	return new Intl.DateTimeFormat("en-US", { month: "short" }).format(
		new Date(2020, month, 1, 12, 0, 0),
	);
}

/** Earliest diary watched year in the quick-log calendar year list. */
export const WATCHED_DATE_PICKER_MIN_YEAR = 1920;

export const WATCHED_DATE_MONTH_INDICES = [
	0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
] as const;

/** Descending years for the picker (newest first), capped at today. */
export function listWatchedDatePickerYears(maxYmd: string): number[] {
	const maxYear = ymdToLocalDate(maxYmd).getFullYear();
	const minYear = Math.max(WATCHED_DATE_PICKER_MIN_YEAR, maxYear - 120);
	const years: number[] = [];
	for (let y = maxYear; y >= minYear; y--) {
		years.push(y);
	}
	return years;
}

export function isWatchedDateYearSelectable(
	year: number,
	maxYmd: string,
): boolean {
	const maxYear = ymdToLocalDate(maxYmd).getFullYear();
	return year <= maxYear && year >= WATCHED_DATE_PICKER_MIN_YEAR;
}

/** Future months in the current year are not selectable. */
export function isWatchedDateMonthSelectable(
	year: number,
	month: number,
	maxYmd: string,
): boolean {
	const max = ymdToLocalDate(maxYmd);
	if (year > max.getFullYear()) return false;
	if (year < max.getFullYear()) return true;
	return month <= max.getMonth();
}

/** Index-stable ids — labels repeat (Tue/Thu, Sun/Sat) so never use label as React `key`. */
const WEEKDAY_LABELS = [
	{ id: "sun", label: "S" },
	{ id: "mon", label: "M" },
	{ id: "tue", label: "T" },
	{ id: "wed", label: "W" },
	{ id: "thu", label: "T" },
	{ id: "fri", label: "F" },
	{ id: "sat", label: "S" },
] as const;

export function getWeekdayLabels(): readonly { id: string; label: string }[] {
	return WEEKDAY_LABELS;
}

export interface WatchedDateCalendarCell {
	ymd: string;
	day: number;
	inCurrentMonth: boolean;
	isDisabled: boolean;
	isToday: boolean;
	isSelected: boolean;
}

/** Month grid for the custom picker — pads leading/trailing days to full weeks. */
export function buildWatchedDateMonthGrid(
	year: number,
	month: number,
	selectedYmd: string,
	maxYmd: string,
): WatchedDateCalendarCell[] {
	const todayYmd = formatTodayYmd();
	const maxDate = ymdToLocalDate(maxYmd);
	const firstOfMonth = new Date(year, month, 1, 12, 0, 0);
	const startWeekday = firstOfMonth.getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const daysInPrevMonth = new Date(year, month, 0).getDate();

	const cells: WatchedDateCalendarCell[] = [];

	for (let i = startWeekday - 1; i >= 0; i--) {
		const day = daysInPrevMonth - i;
		const d = new Date(year, month - 1, day, 12, 0, 0);
		cells.push(toCell(d, false, selectedYmd, todayYmd, maxDate));
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const d = new Date(year, month, day, 12, 0, 0);
		cells.push(toCell(d, true, selectedYmd, todayYmd, maxDate));
	}

	let trailing = 1;
	while (cells.length % 7 !== 0 || cells.length < 35) {
		const d = new Date(year, month + 1, trailing++, 12, 0, 0);
		cells.push(toCell(d, false, selectedYmd, todayYmd, maxDate));
	}

	return cells;
}

function toCell(
	d: Date,
	inCurrentMonth: boolean,
	selectedYmd: string,
	todayYmd: string,
	maxDate: Date,
): WatchedDateCalendarCell {
	const ymd = dateToYmd(d);
	return {
		ymd,
		day: d.getDate(),
		inCurrentMonth,
		isDisabled: d.getTime() > maxDate.getTime(),
		isToday: ymd === todayYmd,
		isSelected: ymd === selectedYmd,
	};
}
