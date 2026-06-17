/** Abbreviate large engagement totals for detail chips (Letterboxd-style). */
export function formatEngagementCountAbbrev(count: number): string {
	if (!Number.isFinite(count) || count < 0) return "0";
	const n = Math.floor(count);
	if (n < 1000) return String(n);
	if (n < 1_000_000) {
		const thousands = n / 1000;
		const rounded =
			n < 10_000 ? Math.round(thousands * 10) / 10 : Math.round(thousands);
		return `${stripTrailingZero(rounded)}K`;
	}
	const millions = n / 1_000_000;
	const rounded =
		n < 10_000_000 ? Math.round(millions * 10) / 10 : Math.round(millions);
	return `${stripTrailingZero(rounded)}M`;
}

function stripTrailingZero(value: number): string {
	return value % 1 === 0 ? String(Math.trunc(value)) : String(value);
}
