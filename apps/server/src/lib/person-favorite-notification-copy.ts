/**
 * Listing deep link for favorite-people alerts — shared by release/streaming jobs
 * and mirrored by web `notificationPayloadHref` when `href` is absent.
 */
export function personFavoriteListingHref(args: {
	mediaKind: "movie" | "tv";
	tmdbId: number;
}): string {
	return args.mediaKind === "movie"
		? `/movies/${args.tmdbId}`
		: `/tv/${args.tmdbId}`;
}

/** Inbox title/body for release alerts — role-aware copy. */
export function formatPersonFavoriteReleaseNotification(args: {
	personName: string;
	roleLabel: string;
	title: string;
	releaseDate?: string | null;
}): { title: string; body: string } {
	const dateBit = args.releaseDate?.trim()
		? ` · ${args.releaseDate.trim()}`
		: "";
	return {
		title: `${args.personName} ${args.roleLabel} ${args.title}`,
		body: `New release${dateBit}`,
	};
}

/** Inbox title/body for streaming alerts — role + provider. */
export function formatPersonFavoriteStreamingNotification(args: {
	personName: string;
	roleLabel: string;
	title: string;
	providerName: string;
}): { title: string; body: string } {
	return {
		title: `${args.personName} ${args.roleLabel} ${args.title}`,
		body: `Now on ${args.providerName}`,
	};
}
