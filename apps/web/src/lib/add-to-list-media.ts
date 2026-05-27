/** Title being added from detail hero or catalogue radial. */
export type AddToListMedia = {
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
};

export function addToListEntityLabel(
	listingKind: AddToListMedia["listingKind"],
): "Film" | "Show" {
	return listingKind === "movie" ? "Film" : "Show";
}

export function addToListItemPostBody(media: AddToListMedia) {
	return media.listingKind === "movie"
		? { movieId: media.tmdbId }
		: { tvId: media.tmdbId };
}
