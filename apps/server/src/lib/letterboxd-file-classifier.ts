/**
 * Classify uploaded files from a Letterboxd data export folder by basename.
 */

export type LetterboxdCsvKind =
	| "diary"
	| "ratings"
	| "watchlist"
	| "reviews"
	| "likes"
	| "watched"
	| "unknown";

/** Map export filename → import phase (case-insensitive basename). */
export function classifyLetterboxdFileName(
	fileName: string,
): LetterboxdCsvKind {
	const base = fileName.toLowerCase().replace(/^.*[/\\]/, "");
	switch (base) {
		case "diary.csv":
			return "diary";
		case "ratings.csv":
			return "ratings";
		case "watchlist.csv":
			return "watchlist";
		case "reviews.csv":
			return "reviews";
		case "films.csv":
			return "likes";
		case "watched.csv":
			return "watched";
		default:
			return "unknown";
	}
}

/** Import gate: diary alone, or any other recognized Letterboxd CSV. */
export function hasRecognizedLetterboxdFile(fileNames: string[]): boolean {
	return fileNames.some((n) => classifyLetterboxdFileName(n) !== "unknown");
}
