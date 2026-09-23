import { planFeatureRequiredBody } from "./plan-feature-access";

/**
 * Decision logic for `PATCH /api/watchlist/alert` — the only server-side
 * enforcement of the paid `watchlist_alerts` feature. I/O is injected so the
 * gate order is tested exhaustively; the route is a thin wrapper.
 */

export type WatchlistAlertTarget =
	| { listingKind: "movie"; tmdbId: number }
	| { listingKind: "tv"; tmdbId: number };

export type WatchlistAlertPreviewPayload = {
	notStreamingCount: number;
	sample: {
		listingKind: "movie" | "tv";
		tmdbId: number;
		title: string;
		posterPath: string | null;
	}[];
};

export type WatchlistAlertPatchDeps = {
	/** Region the patron chose (ISO alpha-2), or `null` — never the US fallback. */
	loadChosenRegion: (userId: string) => Promise<string | null>;
	hasAlertsFeature: (userId: string) => Promise<boolean>;
	loadPreview: (
		userId: string,
		region: string,
	) => Promise<WatchlistAlertPreviewPayload>;
	/** Owner-scoped update; `false` when the title isn't on this watchlist. */
	setAlert: (
		userId: string,
		target: WatchlistAlertTarget,
		enabled: boolean,
	) => Promise<boolean>;
	/** Post-update side effects (cache invalidation, product event). */
	onUpdated: (
		userId: string,
		target: WatchlistAlertTarget,
		enabled: boolean,
	) => Promise<void>;
};

export type WatchlistAlertPatchResult =
	| { status: 200; body: { ok: true; enabled: boolean } }
	| { status: 400; body: string }
	| { status: 401; body: string }
	| {
			status: 403;
			body: ReturnType<typeof planFeatureRequiredBody> & {
				preview: WatchlistAlertPreviewPayload;
			};
	  }
	| { status: 404; body: string }
	| { status: 409; body: { error: string; code: "NEEDS_REGION" } };

export async function handleWatchlistAlertPatch(
	input: {
		userId: string | null;
		body: { movieId?: number; tvId?: number; enabled: boolean };
	},
	deps: WatchlistAlertPatchDeps,
): Promise<WatchlistAlertPatchResult> {
	const { userId, body } = input;
	if (!userId) return { status: 401, body: "Sign in" };
	if ((body.movieId == null) === (body.tvId == null)) {
		return { status: 400, body: "Send exactly one of movieId or tvId" };
	}
	const target: WatchlistAlertTarget =
		body.movieId != null
			? { listingKind: "movie", tmdbId: body.movieId }
			: { listingKind: "tv", tmdbId: body.tvId as number };

	// Turning alerts off is always allowed (e.g. after a downgrade).
	if (body.enabled) {
		// Region first: without a chosen region the job would evaluate US, so
		// "we'll tell you" would be a promise nobody keeps. Also keeps the
		// preview region-scoped (it's only reachable with a region).
		const region = await deps.loadChosenRegion(userId);
		if (region == null) {
			return {
				status: 409,
				body: {
					error: "Set your streaming region first",
					code: "NEEDS_REGION",
				},
			};
		}
		if (!(await deps.hasAlertsFeature(userId))) {
			return {
				status: 403,
				body: {
					...planFeatureRequiredBody(
						"watchlist_alerts",
						"Streaming alerts are part of Attuned",
					),
					preview: await deps.loadPreview(userId, region),
				},
			};
		}
	}

	const updated = await deps.setAlert(userId, target, body.enabled);
	if (!updated) return { status: 404, body: "Not on your watchlist" };
	await deps.onUpdated(userId, target, body.enabled);
	return { status: 200, body: { ok: true, enabled: body.enabled } };
}
