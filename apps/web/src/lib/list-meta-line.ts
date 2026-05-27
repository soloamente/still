/** Inputs for add-to-list picker secondary line (split film/show counts). */
export type ListMetaLineInput = {
	movieItemsCount: number;
	tvItemsCount: number;
	isPublic: boolean;
};

function formatFilmSegment(count: number): string {
	return count === 1 ? "1 film" : `${count} films`;
}

function formatShowSegment(count: number): string {
	return count === 1 ? "1 show" : `${count} shows`;
}

/**
 * Picker / list row meta — `0 titles · Private`, `8 films · 4 shows · Public`, etc.
 */
export function formatListMetaLine(input: ListMetaLineInput): string {
	const visibility = input.isPublic ? "Public" : "Private";
	const movies = input.movieItemsCount;
	const shows = input.tvItemsCount;

	if (movies === 0 && shows === 0) {
		return `0 titles · ${visibility}`;
	}

	const segments: string[] = [];
	if (movies > 0) segments.push(formatFilmSegment(movies));
	if (shows > 0) segments.push(formatShowSegment(shows));

	return `${segments.join(" · ")} · ${visibility}`;
}
