/** Matches web `logRatingToDisplay` — stored tenths 0–100, display = stored / 10. */
export function reviewRatingToDisplay(stored: number): number {
	return stored / 10;
}

export function isValidReviewRatingStored(stored: number): boolean {
	return Number.isInteger(stored) && stored >= 0 && stored <= 100;
}

/** SQL expression: average review rating on 0–10 display scale. */
export function reviewRatingDisplayAvgSql(column: string): string {
	return `avg(${column}::float / 10)`;
}
