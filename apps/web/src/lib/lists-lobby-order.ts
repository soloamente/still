import type { ListBoardRow } from "@/lib/list-board-row";
import { resolveListCoverImageSrc } from "@/lib/list-cover-image";

/**
 * URL + sort helpers for `/lists` — mirrors `watchlist-lobby-order` so the page reuses
 * `HomeStickyChrome` and the home poster grid stack.
 */
export type ListsLobbyOrder = "recently_updated" | "oldest" | "title_az";

const DEFAULT_ORDER: ListsLobbyOrder = "recently_updated";

export function parseListsLobbyOrder(
	raw: string | null | undefined,
): ListsLobbyOrder {
	if (raw === "recently_updated" || raw === "oldest" || raw === "title_az") {
		return raw;
	}
	return DEFAULT_ORDER;
}

export function buildListsLobbyHref(opts: { order: ListsLobbyOrder }): string {
	if (opts.order === DEFAULT_ORDER) return "/lists";
	const params = new URLSearchParams();
	params.set("order", opts.order);
	return `/lists?${params.toString()}`;
}

export function sortListsLobbyRows(
	rows: ListBoardRow[],
	order: ListsLobbyOrder,
): ListBoardRow[] {
	const sorted = [...rows];
	switch (order) {
		case "recently_updated":
			sorted.sort(
				(a, b) =>
					new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
			);
			break;
		case "oldest":
			sorted.sort(
				(a, b) =>
					new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
			);
			break;
		case "title_az":
			sorted.sort((a, b) =>
				a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
			);
			break;
		default: {
			const _exhaustive: never = order;
			void _exhaustive;
		}
	}
	return sorted;
}

/** Lobby grid seed — first cover still drives the poster cell (same shape as `PopularMovieSeed`). */
export type ListLobbySeed = {
	id: string;
	title: string;
	description: string | null;
	poster_url: string | null;
	isPublic: boolean;
	itemsCount: number;
	/** Last edit — community period chips filter on this (lists lobby sort uses it too). */
	updatedAt: string;
	/** `favorites` lists are system-managed — hide destructive context actions. */
	systemKind?: string | null;
};

export function listBoardRowToLobbySeed(row: ListBoardRow): ListLobbySeed {
	const customCover = resolveListCoverImageSrc(
		row.id,
		row.coverImageUrl,
		row.updatedAt,
	);
	if (customCover) {
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			poster_url: customCover,
			isPublic: row.isPublic,
			itemsCount: row.itemsCount,
			updatedAt: row.updatedAt,
			systemKind: row.systemKind ?? null,
		};
	}
	const path = row.coverPosterPaths?.[0] ?? null;
	let poster_url: string | null = null;
	if (path?.length) {
		if (path.startsWith("http")) {
			poster_url = path;
		} else {
			const fragment = path.startsWith("/") ? path : `/${path}`;
			poster_url = `https://image.tmdb.org/t/p/w780${fragment}`;
		}
	}
	return {
		id: row.id,
		title: row.title,
		description: row.description,
		poster_url,
		isPublic: row.isPublic,
		itemsCount: row.itemsCount,
		updatedAt: row.updatedAt,
		systemKind: row.systemKind ?? null,
	};
}
