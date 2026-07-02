import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

/** TV diary scope on a profile showcase tile. */
export type ShowcaseTvLogScope = "show" | "season" | "episode";

/** Up to 4 patron-curated identity slots on the profile hero (film · TV · review). */
export type ShowcaseItem =
	| { kind: "movie"; id: number }
	| {
			kind: "tv";
			id: number;
			logScope?: ShowcaseTvLogScope;
			seasonNumber?: number;
			episodeNumber?: number;
	  }
	| { kind: "review"; id: string };

/** Patron-curated identity strip on profile hero (max 4 slots). */
export const MAX_SHOWCASE_ITEMS = 4;

/** Hydrated tile from `GET /api/profiles/:handle` → `showcaseResolved`. */
export type ProfileShowcaseTile = {
	kind: ShowcaseItem["kind"];
	id: number | string;
	title: string;
	posterPath: string | null;
	/** Review headline for `kind: review` — title or trimmed body excerpt. */
	reviewHeadline: string | null;
	/** TV-only — short scope label under the title (season / episode). */
	tvScopeLabel: string | null;
	logScope: ShowcaseTvLogScope | null;
	seasonNumber: number | null;
	episodeNumber: number | null;
};

export type ProfileShowcaseResolved = {
	items: ProfileShowcaseTile[];
};

/** Stable key for deduping showcase rows in UI state — TV includes diary scope. */
export function showcaseItemKey(
	item: Pick<ShowcaseItem, "kind" | "id"> & {
		logScope?: ShowcaseTvLogScope;
		seasonNumber?: number;
		episodeNumber?: number;
	},
): string {
	if (item.kind === "review") return `review:${item.id}`;
	if (item.kind === "movie") return `movie:${item.id}`;
	const scope = item.logScope ?? "show";
	if (scope === "show") return `tv:${item.id}:show`;
	if (scope === "season")
		return `tv:${item.id}:season:${item.seasonNumber ?? ""}`;
	return `tv:${item.id}:episode:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}`;
}

/** Count filled showcase slots (raw items or hydrated tiles). */
export function showcaseFilledCount(
	items: readonly Pick<ShowcaseItem, "kind" | "id">[],
): number {
	return items.length;
}

/** Parse `showcaseResolved` from the profile API payload on the server or client. */
export function parseProfileShowcaseResolved(
	raw: unknown,
): ProfileShowcaseResolved {
	if (!raw || typeof raw !== "object") return { items: [] };
	const items = (raw as { items?: unknown }).items;
	if (!Array.isArray(items)) return { items: [] };

	const parsed: ProfileShowcaseTile[] = [];
	for (const entry of items) {
		if (!entry || typeof entry !== "object") continue;
		const row = entry as Record<string, unknown>;
		const kind = row.kind;
		if (kind !== "movie" && kind !== "tv" && kind !== "review") continue;
		if (typeof row.title !== "string") continue;
		const id = row.id;
		if (kind === "review") {
			if (typeof id !== "string") continue;
		} else if (typeof id !== "number" || !Number.isFinite(id)) {
			continue;
		}
		const logScope =
			row.logScope === "show" ||
			row.logScope === "season" ||
			row.logScope === "episode"
				? row.logScope
				: kind === "tv"
					? "show"
					: null;
		parsed.push({
			kind,
			id,
			title: row.title,
			posterPath: typeof row.posterPath === "string" ? row.posterPath : null,
			reviewHeadline:
				typeof row.reviewHeadline === "string" ? row.reviewHeadline : null,
			tvScopeLabel:
				typeof row.tvScopeLabel === "string" ? row.tvScopeLabel : null,
			logScope: kind === "tv" ? (logScope ?? "show") : null,
			seasonNumber:
				typeof row.seasonNumber === "number" ? row.seasonNumber : null,
			episodeNumber:
				typeof row.episodeNumber === "number" ? row.episodeNumber : null,
		});
	}
	return { items: parsed };
}

/** Map hydrated tiles back to PATCH body items. */
export function tilesToShowcaseItems(
	tiles: readonly ProfileShowcaseTile[],
): ShowcaseItem[] {
	return tiles.map((tile) => {
		if (tile.kind === "review") {
			return { kind: "review", id: String(tile.id) };
		}
		if (tile.kind === "tv") {
			const logScope = tile.logScope ?? "show";
			if (logScope === "show") {
				return { kind: "tv", id: Number(tile.id), logScope: "show" };
			}
			if (logScope === "season") {
				return {
					kind: "tv",
					id: Number(tile.id),
					logScope: "season",
					seasonNumber: tile.seasonNumber ?? undefined,
				};
			}
			return {
				kind: "tv",
				id: Number(tile.id),
				logScope: "episode",
				seasonNumber: tile.seasonNumber ?? undefined,
				episodeNumber: tile.episodeNumber ?? undefined,
			};
		}
		return { kind: "movie", id: Number(tile.id) };
	});
}

/** Parse raw `showcaseItems` from `GET /api/profiles/me`. */
export function parseShowcaseItemsFromProfile(raw: unknown): ShowcaseItem[] {
	if (!Array.isArray(raw)) return [];
	const items: ShowcaseItem[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object") continue;
		const row = entry as Record<string, unknown>;
		const kind = row.kind;
		if (kind !== "movie" && kind !== "tv" && kind !== "review") continue;
		const id = row.id;
		if (kind === "review") {
			if (typeof id !== "string" || !id.trim()) continue;
			items.push({ kind: "review", id });
			continue;
		}
		if (typeof id !== "number" || !Number.isFinite(id)) continue;
		if (kind === "movie") {
			items.push({ kind: "movie", id });
			continue;
		}
		const logScope =
			row.logScope === "show" ||
			row.logScope === "season" ||
			row.logScope === "episode"
				? row.logScope
				: "show";
		if (logScope === "show") {
			items.push({ kind: "tv", id, logScope: "show" });
			continue;
		}
		if (logScope === "season") {
			if (typeof row.seasonNumber !== "number") continue;
			items.push({
				kind: "tv",
				id,
				logScope: "season",
				seasonNumber: row.seasonNumber,
			});
			continue;
		}
		if (
			typeof row.seasonNumber !== "number" ||
			typeof row.episodeNumber !== "number"
		) {
			continue;
		}
		items.push({
			kind: "tv",
			id,
			logScope: "episode",
			seasonNumber: row.seasonNumber,
			episodeNumber: row.episodeNumber,
		});
	}
	return items;
}

export function isShowcaseItemPresent(
	items: readonly ShowcaseItem[],
	item: ShowcaseItem,
): boolean {
	const key = showcaseItemKey(item);
	return items.some((row) => showcaseItemKey(row) === key);
}

/** Append one showcase slot — returns an error message when blocked. */
export function appendShowcaseItem(
	items: readonly ShowcaseItem[],
	item: ShowcaseItem,
): ShowcaseItem[] | { error: string } {
	if (items.length >= MAX_SHOWCASE_ITEMS) {
		return { error: `You can showcase up to ${MAX_SHOWCASE_ITEMS} items` };
	}
	if (isShowcaseItemPresent(items, item)) {
		return { error: "Already in your showcase" };
	}
	return [...items, item];
}

/** Poster URL for a showcase tile (TMDb w780). */
export function showcasePosterUrl(tile: ProfileShowcaseTile): string | null {
	return profilePosterUrlFromPath(tile.posterPath);
}

/** Listing detail href for film/TV tiles — `null` for reviews (open reader instead). */
export function showcaseListingHref(tile: ProfileShowcaseTile): string | null {
	if (tile.kind === "movie") return `/movies/${tile.id}`;
	if (tile.kind === "tv") return `/tv/${tile.id}`;
	return null;
}

/** Build a hydrated tile stub before PATCH resolves server copy. */
export function showcaseItemToTile(
	item: ShowcaseItem,
	hit: { title: string; posterPath: string | null },
): ProfileShowcaseTile {
	if (item.kind === "review") {
		return {
			kind: "review",
			id: item.id,
			title: hit.title,
			posterPath: hit.posterPath,
			reviewHeadline: hit.title,
			tvScopeLabel: null,
			logScope: null,
			seasonNumber: null,
			episodeNumber: null,
		};
	}
	if (item.kind === "movie") {
		return {
			kind: "movie",
			id: item.id,
			title: hit.title,
			posterPath: hit.posterPath,
			reviewHeadline: null,
			tvScopeLabel: null,
			logScope: null,
			seasonNumber: null,
			episodeNumber: null,
		};
	}
	const logScope = item.logScope ?? "show";
	const seasonNumber = logScope === "show" ? null : (item.seasonNumber ?? null);
	const episodeNumber =
		logScope === "episode" ? (item.episodeNumber ?? null) : null;
	let tvScopeLabel: string | null = null;
	if (logScope === "season" && seasonNumber != null) {
		tvScopeLabel = `Season ${seasonNumber}`;
	} else if (
		logScope === "episode" &&
		seasonNumber != null &&
		episodeNumber != null
	) {
		tvScopeLabel = `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
	}
	return {
		kind: "tv",
		id: item.id,
		title: hit.title,
		posterPath: hit.posterPath,
		reviewHeadline: null,
		tvScopeLabel,
		logScope,
		seasonNumber,
		episodeNumber,
	};
}
