import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

/** Up to 4 patron-curated identity slots on the profile hero (film · TV · review). */
export type ShowcaseItem =
	| { kind: "movie"; id: number }
	| { kind: "tv"; id: number }
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
};

export type ProfileShowcaseResolved = {
	items: ProfileShowcaseTile[];
};

/** Count filled showcase slots (raw items or hydrated tiles). */
export function showcaseFilledCount(
	items: readonly Pick<ShowcaseItem, "kind" | "id">[],
): number {
	return items.length;
}

/** Stable key for deduping showcase rows in UI state. */
export function showcaseItemKey(
	item: Pick<ShowcaseItem, "kind" | "id">,
): string {
	return `${item.kind}:${item.id}`;
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
		parsed.push({
			kind,
			id,
			title: row.title,
			posterPath: typeof row.posterPath === "string" ? row.posterPath : null,
			reviewHeadline:
				typeof row.reviewHeadline === "string" ? row.reviewHeadline : null,
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
		return { kind: tile.kind, id: Number(tile.id) };
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
		items.push({ kind, id });
	}
	return items;
}

export function isShowcaseItemPresent(
	items: readonly ShowcaseItem[],
	item: Pick<ShowcaseItem, "kind" | "id">,
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
