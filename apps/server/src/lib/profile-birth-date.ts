const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ymdToLocalDate(ymd: string): Date {
	return new Date(`${ymd}T12:00:00`);
}

function dateToYmd(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function formatTodayYmd(): string {
	return dateToYmd(new Date());
}

/** Parse and validate profile birth date; rejects future and malformed values. */
export function parseProfileBirthDate(
	input: string | null | undefined,
	maxYmd = formatTodayYmd(),
): string | null {
	if (input == null || input === "") return null;
	if (!ISO_DATE_RE.test(input)) return null;
	const d = ymdToLocalDate(input);
	if (Number.isNaN(d.getTime())) return null;
	if (input > maxYmd) return null;
	return input;
}

/** Public profile copy — month and day only, no birth year. */
export function formatBirthdayDisplayPublic(isoDate: string): string {
	const d = ymdToLocalDate(isoDate);
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
	}).format(d);
}

/** Normalize DB date column (Date or string) to YYYY-MM-DD for API responses. */
export function profileBirthDateToIso(
	value: Date | string | null | undefined,
): string | null {
	if (value == null) return null;
	if (typeof value === "string") {
		return parseProfileBirthDate(value.slice(0, 10));
	}
	return dateToYmd(value);
}

export function readShowBirthDateOnProfilePref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	return preferences?.showBirthDateOnProfile === true;
}
