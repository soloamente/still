import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import {
	DIARY_LOBBY_VENUE_SORT_AS,
	type DiaryLobbyOrder,
	parseDiaryLobbyOrder,
	parseDiaryLobbyVenue,
} from "@/lib/diary-lobby-order";
import { defaultHomeVenueForSort, type HomeVenue } from "@/lib/home-venue";

export type ProfileLedgerTabId = "movies" | "tv";

/** Same `?venue=` tokens as `/diary` (`theaters` / `streaming`). */
export const parseProfileLobbyVenue = parseDiaryLobbyVenue;

/** Reuse diary lobby order tokens — profile ledger is patron watch history, not TMDb sort. */
export type ProfileLobbyOrder = DiaryLobbyOrder;

export const parseProfileLobbyOrder = parseDiaryLobbyOrder;

/** `?favorites=1` narrows Movies / TV ledger to hearted diary logs only. */
export function parseProfileLobbyFavorites(
	raw: string | null | undefined,
): boolean {
	if (!raw) return false;
	const v = raw.trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes";
}

function orderToParam(order: ProfileLobbyOrder): string {
	switch (order) {
		case "latest_seen":
			return "latest";
		case "earliest_seen":
			return "earliest";
		case "title_az":
			return "title";
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

function listingTitle(row: ProfileFilmographyRow): string {
	return row.movie?.title ?? row.tv?.title ?? "";
}

function compareProfileFilmographyRows(
	a: ProfileFilmographyRow,
	b: ProfileFilmographyRow,
	order: ProfileLobbyOrder,
): number {
	switch (order) {
		case "latest_seen":
			return (
				new Date(b.log.watchedAt).getTime() -
				new Date(a.log.watchedAt).getTime()
			);
		case "earliest_seen":
			return (
				new Date(a.log.watchedAt).getTime() -
				new Date(b.log.watchedAt).getTime()
			);
		case "title_az": {
			const t = listingTitle(a).localeCompare(listingTitle(b), undefined, {
				sensitivity: "base",
			});
			if (t !== 0) return t;
			return (
				new Date(b.log.watchedAt).getTime() -
				new Date(a.log.watchedAt).getTime()
			);
		}
		default: {
			const _exhaustive: never = order;
			return _exhaustive;
		}
	}
}

/**
 * Profile venue filter — legacy logs without `watchVenue` stay in both slices until edited.
 */
export function profileLogMatchesProfileLobbyVenue(
	row: ProfileFilmographyRow,
	lobbyVenue: HomeVenue,
): boolean {
	const v = row.log.watchVenue;
	if (v !== "theaters" && v !== "streaming") return true;
	return v === lobbyVenue;
}

/** Stable sort for profile Movies / TV ledger grids. */
export function sortProfileFilmographyRows(
	rows: ProfileFilmographyRow[],
	order: ProfileLobbyOrder,
): ProfileFilmographyRow[] {
	return rows
		.slice()
		.sort((a, b) => compareProfileFilmographyRows(a, b, order));
}

/** Builds `/profile/:handle` links — preserves `tab`, `order`, `venue`, and favorites filter. */
export function buildProfileLobbyHref(input: {
	handle: string;
	tab: ProfileLedgerTabId;
	order: ProfileLobbyOrder;
	venue: HomeVenue;
	favoritesOnly?: boolean;
}): string {
	const params = new URLSearchParams();
	params.set("tab", input.tab);
	if (input.order !== "latest_seen") {
		params.set("order", orderToParam(input.order));
	}
	const defaultVenue = defaultHomeVenueForSort(DIARY_LOBBY_VENUE_SORT_AS);
	if (input.venue !== defaultVenue) {
		params.set("venue", input.venue);
	}
	if (input.favoritesOnly) {
		params.set("favorites", "1");
	}
	return `/profile/${encodeURIComponent(input.handle)}?${params.toString()}`;
}
