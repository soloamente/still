/** Patron quote timestamp helpers — mirrors server `listing-quote.ts` for form validation. */

/** Format milliseconds as zero-padded HH:MM:SS for display. */
export function formatQuoteTimestampMs(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0 || !Number.isInteger(ms)) {
		throw new Error(
			"Timestamp must be a non-negative integer millisecond value",
		);
	}

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	return [
		String(hours).padStart(2, "0"),
		String(minutes).padStart(2, "0"),
		String(seconds).padStart(2, "0"),
	].join(":");
}

/**
 * Parse patron-facing timestamp input — `H:MM:SS`, `HH:MM:SS`, or `MM:SS`.
 * Returns null when the field is left blank.
 */
export function parseQuoteTimestampInput(raw: string): number | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	const segments = trimmed.split(":").map((part) => part.trim());
	if (segments.length < 2 || segments.length > 3) {
		throw new Error("Timestamp must use MM:SS or HH:MM:SS format");
	}

	const nums = segments.map((part) => {
		if (!/^\d+$/.test(part)) {
			throw new Error("Timestamp must use MM:SS or HH:MM:SS format");
		}
		return Number(part);
	});

	let hours = 0;
	let minutes = 0;
	let seconds = 0;

	if (nums.length === 2) {
		[minutes, seconds] = nums;
	} else {
		[hours, minutes, seconds] = nums;
	}

	if (minutes > 59 || seconds > 59) {
		throw new Error("Timestamp minutes and seconds must be between 00 and 59");
	}

	const totalSeconds = hours * 3600 + minutes * 60 + seconds;
	return totalSeconds * 1000;
}
