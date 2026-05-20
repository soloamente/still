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

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function getWeekdayLabels(): readonly string[] {
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
