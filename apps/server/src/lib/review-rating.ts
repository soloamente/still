/** Matches web `logRatingToDisplay` — tenths or legacy 1–10 whole. */
export function reviewRatingToDisplay(stored: number): number {
	if (stored > 10) return stored / 10;
	return stored;
}

export function isValidReviewRatingStored(stored: number): boolean {
	return Number.isInteger(stored) && stored >= 0 && stored <= 100;
}

/** SQL expression: average review rating on 0–10 display scale. */
export function reviewRatingDisplayAvgSql(column: string): string {
	return `avg(CASE WHEN ${column} > 10 THEN ${column}::float / 10 ELSE ${column} END)`;
}
