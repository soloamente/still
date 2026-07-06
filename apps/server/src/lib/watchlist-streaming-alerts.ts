import {
	db,
	movie,
	notification,
	profile,
	tv,
	user,
	watchlistItem,
	watchlistStreamingSnapshot,
} from "@still/db";
import { and, eq, sql } from "drizzle-orm";

import { deliverNotification } from "./notification-delivery";
import {
	loadPatronEntitlements,
	type PatronEntitlements,
} from "./patron-entitlements";
import { patronHasPlanFeature } from "./plan-feature-access";
import { recordProductEvent } from "./record-product-event";

/** Stored under `profile.preferences` — Task 18 adds the Settings toggle UI. */
export const PROFILE_PREF_WATCHLIST_STREAMING_ALERTS =
	"watchlistStreamingAlerts" as const;

/** Must match web `PROFILE_PREF_CATALOG_TMDB_WATCH_REGION`. */
export const PROFILE_PREF_CATALOG_TMDB_WATCH_REGION =
	"catalogTmdbWatchRegion" as const;

export type TmdbWatchProviderRow = {
	provider_id: number;
	provider_name: string;
	logo_path?: string;
	display_priority?: number;
};

export type TmdbWatchProvidersByCountry = Record<
	string,
	{
		link?: string;
		flatrate?: TmdbWatchProviderRow[];
		rent?: TmdbWatchProviderRow[];
		buy?: TmdbWatchProviderRow[];
	}
>;

export type StreamingProviderRef = {
	providerId: number;
	providerName: string;
};

export type WatchlistStreamingDiffResult = {
	region: string;
	currentProviders: StreamingProviderRef[];
	newProviders: StreamingProviderRef[];
	isFirstSnapshot: boolean;
};

export function isWatchlistStreamingAlertsJobEnabled(): boolean {
	return process.env.WATCHLIST_STREAMING_ALERTS_ENABLED !== "false";
}

/** Patron opt-in for watchlist streaming notifications — default on per spec. */
export function readWatchlistStreamingAlertsPref(
	preferences: Record<string, unknown> | null | undefined,
): boolean {
	const raw = preferences?.[PROFILE_PREF_WATCHLIST_STREAMING_ALERTS];
	if (typeof raw === "boolean") return raw;
	return true;
}

/** Resolve ISO region for provider diff — defaults to US when unset. */
export function readCatalogWatchRegionPref(
	preferences: Record<string, unknown> | null | undefined,
): string {
	const raw = preferences?.[PROFILE_PREF_CATALOG_TMDB_WATCH_REGION];
	if (typeof raw !== "string") return "US";
	const region = raw.trim().toUpperCase();
	if (!region || region === "ALL" || region === "ANY" || region === "WORLD") {
		return "US";
	}
	if (region.length === 2 && /^[A-Z]{2}$/.test(region)) return region;
	return "US";
}

/** Flatrate subscription services available in a TMDb watch region. */
export function flatrateProvidersForRegion(
	watchProviders: TmdbWatchProvidersByCountry | undefined,
	region: string,
): StreamingProviderRef[] {
	const country = watchProviders?.[region.trim().toUpperCase()];
	if (!country?.flatrate?.length) return [];

	const seen = new Set<number>();
	const providers: StreamingProviderRef[] = [];
	for (const row of country.flatrate) {
		if (!Number.isFinite(row.provider_id)) continue;
		const providerId = Math.trunc(row.provider_id);
		if (seen.has(providerId)) continue;
		seen.add(providerId);
		const name = row.provider_name?.trim();
		if (!name) continue;
		providers.push({ providerId, providerName: name });
	}

	providers.sort((a, b) => a.providerId - b.providerId);
	return providers;
}

function providerIdsFromRefs(refs: StreamingProviderRef[]): number[] {
	return refs.map((ref) => ref.providerId);
}

/**
 * Compare the previous snapshot with today's flatrate providers.
 * First snapshot establishes a baseline without notifying.
 */
export function diffWatchlistStreamingProviders(args: {
	previousProviderIds: number[] | null;
	currentProviders: StreamingProviderRef[];
}): StreamingProviderRef[] {
	if (args.previousProviderIds == null) return [];
	const previous = new Set(args.previousProviderIds);
	return args.currentProviders.filter(
		(provider) => !previous.has(provider.providerId),
	);
}

export function evaluateWatchlistStreamingDiff(args: {
	region: string;
	previousProviderIds: number[] | null;
	watchProviders: TmdbWatchProvidersByCountry | undefined;
}): WatchlistStreamingDiffResult {
	const currentProviders = flatrateProvidersForRegion(
		args.watchProviders,
		args.region,
	);
	const isFirstSnapshot = args.previousProviderIds == null;
	const newProviders = diffWatchlistStreamingProviders({
		previousProviderIds: args.previousProviderIds,
		currentProviders,
	});
	return {
		region: args.region,
		currentProviders,
		newProviders,
		isFirstSnapshot,
	};
}

/** Cached TMDb `watch/providers.results` blob on `movie` / `tv` rows. */
export function watchProvidersFromTmdbJson(
	tmdbJson: unknown,
): TmdbWatchProvidersByCountry | undefined {
	if (!tmdbJson || typeof tmdbJson !== "object") return undefined;
	const providers = (
		tmdbJson as {
			"watch/providers"?: { results?: TmdbWatchProvidersByCountry };
		}
	)["watch/providers"];
	return providers?.results;
}

/** Watchlist lobby pill copy — first flatrate service in the patron region. */
export function formatWatchlistStreamingPill(providerName: string): string {
	const name = providerName.trim();
	return name ? `Now on ${name}` : "";
}

/** Primary subscription provider for a cached listing in the patron's region. */
export function primaryFlatrateProviderName(
	tmdbJson: unknown,
	region: string,
): string | null {
	const providers = flatrateProvidersForRegion(
		watchProvidersFromTmdbJson(tmdbJson),
		region,
	);
	return providers[0]?.providerName ?? null;
}

export function buildWatchlistStreamingAlertEmailContent(args: {
	title: string;
	providerName: string;
	region: string;
	href: string;
	appOrigin?: string;
}): { subject: string; text: string; html: string } {
	const title = args.title.trim() || "A watchlist title";
	const provider = args.providerName.trim() || "a streaming service";
	const region = args.region.trim().toUpperCase() || "your region";
	const origin = (args.appOrigin ?? "").replace(/\/$/, "");
	const url = `${origin}${args.href.startsWith("/") ? args.href : `/${args.href}`}`;
	const subject = `Now streaming · ${title}`;
	const text = `${title} is now on ${provider} in ${region}.\n\nOpen in Sense: ${url}`;
	const html = `<p><strong>${title}</strong> is now on ${provider} in ${region}.</p><p><a href="${url}">Open in Sense</a></p>`;
	return { subject, text, html };
}

/** Patron pref + Attuned entitlement — both required before alerts fire. */
export function shouldProcessWatchlistStreamingAlerts(
	preferences: Record<string, unknown> | null,
	entitlements: Pick<PatronEntitlements, "effectiveTier" | "featureGrants">,
): boolean {
	if (!readWatchlistStreamingAlertsPref(preferences)) return false;
	return patronHasPlanFeature(entitlements, "watchlist_alerts");
}

async function sendProWatchlistStreamingEmail(args: {
	userId: string;
	title: string;
	providerName: string;
	region: string;
	href: string;
}): Promise<void> {
	try {
		const [row] = await db
			.select({ email: user.email })
			.from(profile)
			.innerJoin(user, eq(user.id, profile.userId))
			.where(eq(profile.userId, args.userId))
			.limit(1);
		if (!row?.email?.trim()) return;

		const entitlements = await loadPatronEntitlements(args.userId);
		if (!patronHasPlanFeature(entitlements, "watchlist_alerts")) return;

		const { sendEmail } = await import("@still/auth/lib/send-email");
		const appOrigin = process.env.WEB_APP_ORIGIN?.trim() || "https://sense.app";
		const content = buildWatchlistStreamingAlertEmailContent({
			...args,
			appOrigin,
		});
		await sendEmail({
			to: row.email.trim(),
			subject: content.subject,
			text: content.text,
			html: content.html,
		});
	} catch (err) {
		console.error("[watchlist-streaming-email]", args.userId, err);
	}
}

function listingDetailHref(args: {
	movieId: number | null;
	tvId: number | null;
}): string | null {
	if (args.movieId != null) return `/movies/${args.movieId}`;
	if (args.tvId != null) return `/tv/${args.tvId}`;
	return null;
}

/** One watchlist title + region row — movie and TV are mutually exclusive FKs. */
function snapshotRowWhere(args: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	region: string;
}) {
	const shared = [
		eq(watchlistStreamingSnapshot.userId, args.userId),
		eq(watchlistStreamingSnapshot.region, args.region),
	];
	if (args.movieId != null) {
		return and(...shared, eq(watchlistStreamingSnapshot.movieId, args.movieId));
	}
	if (args.tvId != null) {
		return and(...shared, eq(watchlistStreamingSnapshot.tvId, args.tvId));
	}
	return null;
}

async function loadSnapshotProviderIds(args: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	region: string;
}): Promise<number[] | null> {
	const where = snapshotRowWhere(args);
	if (!where) return null;

	const [row] = await db
		.select({ providerIds: watchlistStreamingSnapshot.providerIds })
		.from(watchlistStreamingSnapshot)
		.where(where)
		.limit(1);

	if (!row) return null;
	return Array.isArray(row.providerIds)
		? row.providerIds.filter((id) => typeof id === "number")
		: [];
}

async function upsertSnapshot(args: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	region: string;
	providerIds: number[];
}): Promise<void> {
	const checkedAt = new Date();
	const where = snapshotRowWhere(args);
	if (!where) return;

	const existing = await loadSnapshotProviderIds({
		userId: args.userId,
		movieId: args.movieId,
		tvId: args.tvId,
		region: args.region,
	});

	if (existing != null) {
		await db
			.update(watchlistStreamingSnapshot)
			.set({ providerIds: args.providerIds, checkedAt })
			.where(where);
		return;
	}

	await db.insert(watchlistStreamingSnapshot).values({
		userId: args.userId,
		movieId: args.movieId,
		tvId: args.tvId,
		region: args.region,
		providerIds: args.providerIds,
		checkedAt,
	});
}

async function streamingAlertAlreadySent(args: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	providerId: number;
}): Promise<boolean> {
	const listingKey =
		args.movieId != null
			? sql`(${notification.payload}->>'movieId')::int = ${args.movieId}`
			: sql`(${notification.payload}->>'tvId')::int = ${args.tvId}`;

	const [row] = await db
		.select({ id: notification.id })
		.from(notification)
		.where(
			and(
				eq(notification.userId, args.userId),
				eq(notification.kind, "watchlist_now_streaming"),
				listingKey,
				sql`(${notification.payload}->>'providerId')::int = ${args.providerId}`,
			),
		)
		.limit(1);
	return Boolean(row);
}

async function notifyNewStreamingProvider(args: {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	title: string;
	region: string;
	provider: StreamingProviderRef;
}): Promise<boolean> {
	if (
		await streamingAlertAlreadySent({
			userId: args.userId,
			movieId: args.movieId,
			tvId: args.tvId,
			providerId: args.provider.providerId,
		})
	) {
		return false;
	}

	const href = listingDetailHref({
		movieId: args.movieId,
		tvId: args.tvId,
	});
	if (!href) return false;

	await deliverNotification({
		userId: args.userId,
		kind: "watchlist_now_streaming",
		title: `Now streaming · ${args.title}`,
		body: `${args.provider.providerName} in ${args.region}`,
		payload: {
			movieId: args.movieId,
			tvId: args.tvId,
			title: args.title,
			region: args.region,
			providerId: args.provider.providerId,
			providerName: args.provider.providerName,
			href,
		},
	});

	// Pro patrons also get a transactional email when a title newly streams nearby.
	void sendProWatchlistStreamingEmail({
		userId: args.userId,
		title: args.title,
		providerName: args.provider.providerName,
		region: args.region,
		href,
	});

	void recordProductEvent(args.userId, "streaming_alert.sent", {
		movieId: args.movieId,
		tvId: args.tvId,
		providerId: args.provider.providerId,
		region: args.region,
	});

	return true;
}

export type WatchlistStreamingRow = {
	userId: string;
	movieId: number | null;
	tvId: number | null;
	title: string;
	tmdbJson: unknown;
	preferences: Record<string, unknown> | null;
};

/** Process one watchlist row — exported for tests and the sync job. */
export async function processWatchlistStreamingRow(
	row: WatchlistStreamingRow,
): Promise<{ notified: number; baselined: boolean }> {
	const entitlements = await loadPatronEntitlements(row.userId);
	if (!shouldProcessWatchlistStreamingAlerts(row.preferences, entitlements)) {
		return { notified: 0, baselined: false };
	}

	const region = readCatalogWatchRegionPref(row.preferences);
	const previousProviderIds = await loadSnapshotProviderIds({
		userId: row.userId,
		movieId: row.movieId,
		tvId: row.tvId,
		region,
	});

	const diff = evaluateWatchlistStreamingDiff({
		region,
		previousProviderIds,
		watchProviders: watchProvidersFromTmdbJson(row.tmdbJson),
	});

	await upsertSnapshot({
		userId: row.userId,
		movieId: row.movieId,
		tvId: row.tvId,
		region,
		providerIds: providerIdsFromRefs(diff.currentProviders),
	});

	if (diff.isFirstSnapshot || diff.newProviders.length === 0) {
		return { notified: 0, baselined: diff.isFirstSnapshot };
	}

	let notified = 0;
	for (const provider of diff.newProviders) {
		const sent = await notifyNewStreamingProvider({
			userId: row.userId,
			movieId: row.movieId,
			tvId: row.tvId,
			title: row.title,
			region,
			provider,
		});
		if (sent) notified += 1;
	}

	return { notified, baselined: false };
}

/**
 * Daily job — diff cached TMDb watch providers for each watchlist title per patron
 * region and insert `watchlist_now_streaming` inbox rows for new services.
 */
export async function syncWatchlistStreamingAlerts(): Promise<void> {
	if (!isWatchlistStreamingAlertsJobEnabled()) return;

	const rows = await db
		.select({
			userId: watchlistItem.userId,
			movieId: watchlistItem.movieId,
			tvId: watchlistItem.tvId,
			movieTitle: movie.title,
			tvTitle: tv.title,
			movieTmdbJson: movie.tmdbJson,
			tvTmdbJson: tv.tmdbJson,
			preferences: profile.preferences,
		})
		.from(watchlistItem)
		.innerJoin(profile, eq(watchlistItem.userId, profile.userId))
		.leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
		.leftJoin(tv, eq(watchlistItem.tvId, tv.tmdbId));

	for (const row of rows) {
		try {
			const title =
				row.movieId != null
					? (row.movieTitle?.trim() ?? "Film")
					: (row.tvTitle?.trim() ?? "Series");
			const tmdbJson = row.movieId != null ? row.movieTmdbJson : row.tvTmdbJson;

			await processWatchlistStreamingRow({
				userId: row.userId,
				movieId: row.movieId,
				tvId: row.tvId,
				title,
				tmdbJson,
				preferences:
					(row.preferences as Record<string, unknown> | null | undefined) ??
					null,
			});
		} catch (err) {
			console.error(
				`[watchlist-streaming] user=${row.userId} movie=${row.movieId} tv=${row.tvId}`,
				err,
			);
		}
	}
}
