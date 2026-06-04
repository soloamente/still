export type ActivityKind = "log" | "review" | "list" | "divergence";

export type ActivityItem = {
	kind: ActivityKind;
	at: string;
	payload: unknown;
};

export type FeedPerson = {
	user: { id: string; name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
};

export type FeedMedia = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
} | null;

export type LogPayload = FeedPerson & {
	log: {
		id: string;
		watchedAt: string;
		rating: number | null;
		liked: boolean;
		rewatch: boolean;
		note: string | null;
	};
	movie: FeedMedia;
	tv?: FeedMedia;
};

export type ReviewPayload = FeedPerson & {
	review: {
		id: string;
		title: string | null;
		body: string;
		rating: number | null;
		likesCount: number;
		commentsCount: number;
		publishedAt: string;
	};
	movie: FeedMedia;
};

export type ListPayload = FeedPerson & {
	list: {
		id: string;
		title: string;
		description: string | null;
		itemsCount: number;
		coverMovieIds: number[];
		coverPosterPaths?: (string | null)[];
		coverImageUrl?: string | null;
		updatedAt: string;
	};
};

export function patronName(person: FeedPerson): string {
	return person.profile?.displayName ?? person.user?.name ?? "Someone";
}

export function patronHandle(person: FeedPerson): string {
	return person.profile?.handle ?? person.user?.id ?? "user";
}

export function coerceActivityTimestamp(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "string") return value;
	return new Date().toISOString();
}

export function parseFeedApiActivityItems(
	payload:
		| { items?: { kind: string; at: string | Date; payload: unknown }[] }
		| null
		| undefined,
): ActivityItem[] {
	const raw = payload?.items ?? [];
	return raw
		.filter(
			(
				item,
			): item is { kind: ActivityKind; at: string | Date; payload: unknown } =>
				item.kind === "log" ||
				item.kind === "review" ||
				item.kind === "list" ||
				item.kind === "divergence",
		)
		.map((item) => ({
			kind: item.kind,
			at: coerceActivityTimestamp(item.at),
			payload: item.payload,
		}));
}

export function activityRowKey(item: ActivityItem): string {
	const pl = item.payload as Record<string, unknown>;
	if (
		item.kind === "log" &&
		pl.log &&
		typeof pl.log === "object" &&
		"id" in pl.log
	) {
		return `log:${(pl.log as { id: string }).id}`;
	}
	if (
		item.kind === "review" &&
		pl.review &&
		typeof pl.review === "object" &&
		"id" in pl.review
	) {
		return `review:${(pl.review as { id: string }).id}`;
	}
	if (
		item.kind === "list" &&
		pl.list &&
		typeof pl.list === "object" &&
		"id" in pl.list
	) {
		return `list:${(pl.list as { id: string }).id}`;
	}
	if (item.kind === "divergence") {
		const mediaId =
			typeof pl.movieId === "number"
				? `m:${pl.movieId}`
				: typeof pl.tvId === "number"
					? `t:${pl.tvId}`
					: "unknown";
		return `divergence:${mediaId}`;
	}
	return `${item.kind}:${item.at}`;
}
