import { isValidYmd } from "@/lib/log-watched-date";

/**
 * Normalize profile `birthDate` from API / Eden (YYYY-MM-DD, ISO datetime, or Date)
 * to a calendar `YYYY-MM-DD` for the settings picker. Returns null when missing/invalid.
 */
export function normalizeProfileBirthDateYmd(value: unknown): string | null {
	if (value == null || value === "") return null;

	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		// Date-only columns usually arrive as UTC midnight — use UTC parts so the
		// calendar day does not shift in western timezones.
		const y = value.getUTCFullYear();
		const m = String(value.getUTCMonth() + 1).padStart(2, "0");
		const day = String(value.getUTCDate()).padStart(2, "0");
		const ymd = `${y}-${m}-${day}`;
		return isValidYmd(ymd) ? ymd : null;
	}

	if (typeof value === "string") {
		const ymd = value.trim().slice(0, 10);
		return isValidYmd(ymd) ? ymd : null;
	}

	return null;
}
