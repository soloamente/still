/**
 * Watch tonight ranking for `/watchlist` — pure, no I/O. The route loads
 * signals per watchlist row; this module turns them into a score + one pill.
 */

export type WatchlistTonightSignals = {
	/** First flatrate provider in the patron's region, or null. */
	providerName: string | null;
	/** Senders the viewer can still see; `scrubbed` = sensitive send (never named). */
	recommenders: { name: string; scrubbed: boolean }[];
	/** Title of one of the viewer's own lists containing this title. */
	ownListTitle: string | null;
	/** 0–1 genre affinity from the viewer's diary taste profile. */
	tasteAffinity: number;
	addedAt: Date;
	now: Date;
};

export type WatchlistTonightReasonKind =
	| "available"
	| "friend"
	| "list"
	| "taste"
	| "recent";

export type WatchlistTonightReason = {
	kind: WatchlistTonightReasonKind;
	label: string;
};

const AVAILABLE_POINTS = 40;
const FRIEND_BASE_POINTS = 30;
const FRIEND_EXTRA_POINTS = 5;
const FRIEND_CAP = 40;
const LIST_POINTS = 20;
const TASTE_MAX = 20;
const RECENT_MAX = 10;
const RECENT_WINDOW_DAYS = 30;
const RECENT_PILL_MAX_DAYS = 3;
const DAY_MS = 86_400_000;

/** Names the first visible sender; scrubbed (sensitive) senders are never named. */
function friendLabel(
	recommenders: WatchlistTonightSignals["recommenders"],
): string {
	const named = recommenders.filter((r) => !r.scrubbed);
	const first = named[0];
	if (!first) return "Recommended to you";
	const others = recommenders.length - 1;
	if (others <= 0) return `${first.name} recommended`;
	return `${first.name} and ${others} ${others === 1 ? "other" : "others"} recommended`;
}

export function scoreWatchlistTonight(signals: WatchlistTonightSignals): {
	score: number;
	reason: WatchlistTonightReason | null;
} {
	// Table order doubles as the tie-break order for the reason pill.
	const parts: {
		kind: WatchlistTonightReasonKind;
		points: number;
		label: string;
	}[] = [];

	if (signals.providerName?.trim()) {
		parts.push({
			kind: "available",
			points: AVAILABLE_POINTS,
			label: `Now on ${signals.providerName.trim()}`,
		});
	}
	if (signals.recommenders.length > 0) {
		const points = Math.min(
			FRIEND_CAP,
			FRIEND_BASE_POINTS +
				FRIEND_EXTRA_POINTS * (signals.recommenders.length - 1),
		);
		parts.push({
			kind: "friend",
			points,
			label: friendLabel(signals.recommenders),
		});
	}
	if (signals.ownListTitle?.trim()) {
		parts.push({
			kind: "list",
			points: LIST_POINTS,
			label: `On your ${signals.ownListTitle.trim()} list`,
		});
	}
	// Clamp affinity to 0–1 so out-of-range inputs cannot exceed TASTE_MAX.
	const affinity = Math.min(1, Math.max(0, signals.tasteAffinity));
	if (affinity > 0) {
		parts.push({
			kind: "taste",
			points: Math.round(affinity * TASTE_MAX),
			label: "Matches your taste",
		});
	}
	// Recency decays linearly from RECENT_MAX (saved now) to 0 at RECENT_WINDOW_DAYS.
	const ageDays = (signals.now.getTime() - signals.addedAt.getTime()) / DAY_MS;
	const recent = Math.round(
		Math.max(0, Math.min(1, 1 - ageDays / RECENT_WINDOW_DAYS)) * RECENT_MAX,
	);
	if (recent > 0) {
		parts.push({ kind: "recent", points: recent, label: "Added recently" });
	}

	const score = parts.reduce((sum, p) => sum + p.points, 0);
	// Recency always scores, but only very fresh saves earn the pill — otherwise
	// no-signal watchlists read wall-to-wall "Added recently".
	const recentPillEligible = ageDays < RECENT_PILL_MAX_DAYS;
	// Strict `>` keeps the earliest part on ties, so table order breaks ties.
	let best: (typeof parts)[number] | null = null;
	for (const part of parts) {
		if (part.kind === "recent" && !recentPillEligible) continue;
		if (part.points > 0 && (best == null || part.points > best.points))
			best = part;
	}
	return {
		score,
		reason: best ? { kind: best.kind, label: best.label } : null,
	};
}

/** Score desc, then newest save first, then `key` asc for a stable order. */
export function rankWatchlistTonight<
	T extends { key: string; signals: WatchlistTonightSignals },
>(rows: T[]): (T & { score: number; reason: WatchlistTonightReason | null })[] {
	return rows
		.map((row) => ({ ...row, ...scoreWatchlistTonight(row.signals) }))
		.sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score;
			const added = b.signals.addedAt.getTime() - a.signals.addedAt.getTime();
			if (added !== 0) return added;
			return a.key.localeCompare(b.key);
		});
}
