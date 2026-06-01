import type { TvLogScope } from "@/lib/tv-watch-types";

/** One row from `GET /api/logs/me/by-tv/:tvId` (Drizzle `log` shape). */
export interface MyTvLog {
	id: string;
	liked: boolean;
	rewatch?: boolean;
	rating?: number | null;
	note?: string | null;
	watchedAt?: string | null;
	containsSpoilers?: boolean;
	watchVenue?: string | null;
	logScope?: TvLogScope | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	visibility?: "public" | "followers" | "friends" | "private";
}
