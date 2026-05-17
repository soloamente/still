/**
 * Builds a compact “who’s active” list for the home page right rail from the same
 * feed payload the lobby list uses — no extra API round-trip.
 */

export type HomeFriendRailEntry = {
	handle: string;
	displayName: string;
	image: string | null;
	/** One-line summary for the rail (most recent activity per person in this window). */
	snippet: string;
	atMs: number;
};

type ActivityKind = "log" | "review" | "list";

type FeedItem = {
	kind: ActivityKind;
	at: string;
	payload: unknown;
};

type PersonRow = {
	user: { id: string; name: string; image: string | null } | null;
	profile: { handle: string; displayName: string } | null;
};

function personFromPayload(payload: unknown): PersonRow | null {
	if (!payload || typeof payload !== "object") return null;
	const p = payload as PersonRow;
	const handle = p.profile?.handle ?? p.user?.id;
	if (!handle) return null;
	return p;
}

function snippetForItem(item: FeedItem): string {
	const payload = item.payload as Record<string, unknown>;
	if (item.kind === "log") {
		const movie = payload.movie as { title?: string } | null;
		return movie?.title ? `Watched ${movie.title}` : "Logged a film";
	}
	if (item.kind === "review") {
		const movie = payload.movie as { title?: string } | null;
		return movie?.title ? `Reviewed ${movie.title}` : "Published a review";
	}
	const list = payload.list as { title?: string } | null;
	return list?.title ? `Updated ${list.title}` : "Updated a list";
}

/** Keeps the most recent row per `handle` (by `at`), then sorts newest-first. */
export function deriveFriendRailEntries(
	items: FeedItem[],
	limit = 8,
): HomeFriendRailEntry[] {
	const best = new Map<string, HomeFriendRailEntry>();

	for (const item of items) {
		const person = personFromPayload(item.payload);
		if (!person) continue;
		const handle = person.profile?.handle ?? person.user?.id ?? "";
		if (!handle) continue;
		const atMs = new Date(item.at).getTime();
		if (Number.isNaN(atMs)) continue;

		const prev = best.get(handle);
		if (prev && atMs <= prev.atMs) continue;

		best.set(handle, {
			handle,
			displayName:
				person.profile?.displayName ?? person.user?.name ?? "Someone",
			image: person.user?.image ?? null,
			snippet: snippetForItem(item),
			atMs,
		});
	}

	return [...best.values()].sort((a, b) => b.atMs - a.atMs).slice(0, limit);
}
