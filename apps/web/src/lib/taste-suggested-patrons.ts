/** Client types for `GET /api/taste/suggested-patrons` (SN.16). */

export type TasteSuggestedPatronRow = {
	userId: string;
	handle: string;
	displayName: string;
	image: string | null;
	compatibilityPercent: number;
	sharedWatches: number;
	sharedGenrePhrase: string | null;
};

export type TasteSuggestedPatronsPayload = {
	coldStart: boolean;
	patrons: TasteSuggestedPatronRow[];
};

export function tasteSuggestedPatronMetaLine(
	row: TasteSuggestedPatronRow,
): string {
	const parts: string[] = [`${row.compatibilityPercent}% taste match`];
	if (row.sharedWatches > 0) {
		const label = row.sharedWatches === 1 ? "shared title" : "shared titles";
		parts.push(`${row.sharedWatches} ${label}`);
	}
	if (row.sharedGenrePhrase) {
		parts.push(row.sharedGenrePhrase);
	}
	return parts.join(" · ");
}
