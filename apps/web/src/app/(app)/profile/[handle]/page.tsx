import { cn } from "@still/ui/lib/utils";
import { notFound, redirect } from "next/navigation";

import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import { ProfileLobbyChrome } from "@/components/profile/profile-lobby-chrome";
import { ProfilePatronHeader } from "@/components/profile/profile-patron-header";
import {
	type ProfileEarnedBadge,
	ProfilePatronMilestones,
	type ProfileUnlockedAchievement,
} from "@/components/profile/profile-patron-milestones";
import { ProfileTabPanels } from "@/components/profile/profile-tab-panels";
import type {
	ProfileSocialTabId,
	ProfileTabId,
} from "@/components/profile/profile-tab-toolbar";
import { ProfileTopBar } from "@/components/profile/profile-top-bar";
import { authServer } from "@/lib/auth-server";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";
import {
	buildProfileLobbyHref,
	type ProfileLedgerTabId,
	parseProfileLobbyFavorites,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
	profileLogMatchesProfileLobbyVenue,
	sortProfileFilmographyRows,
} from "@/lib/profile-lobby-order";
import { readCatalogMonochromePeersOnHoverPref } from "@/lib/profile-preferences";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ handle: string }>;
}) {
	const { handle } = await params;
	return { title: `@${handle}` };
}

type ProfileData = {
	user: { id: string; name: string | null; image: string | null };
	profile: {
		userId: string;
		handle: string;
		displayName: string;
		bio: string | null;
		pronouns: string | null;
		location: string | null;
		website: string | null;
		bannerUrl: string | null;
		accentColor: string | null;
		favoriteMovieIds: number[];
		sectionOrder: string[] | null;
		isPrivate: boolean;
	};
	stats: { followers: number; following: number };
	isFollowing: boolean;
	/** Patron watch logs (up to server cap) — deduped per title in `filmographyFromRecentlyWatched`. */
	recentlyWatched: ProfileFilmographyRow[];
	recentReviews: {
		review: {
			id: string;
			userId: string;
			movieId: number;
			title: string | null;
			body: string;
			rating: number | null;
			likesCount: number;
			commentsCount: number;
			publishedAt: string;
		};
		movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	}[];
	lists: {
		id: string;
		title: string;
		itemsCount: number;
		likesCount: number;
		coverMovieIds: number[];
		coverPosterPaths: (string | null)[];
		updatedAt: string;
		isPublic: boolean;
		description: string | null;
	}[];
	pinnedBadges: {
		badgeId: string;
		awardedAt: string;
	}[];
};

/** Community chips after the ledger divider — Lists first per profile IA. */
const PROFILE_TOOLBAR_SOCIAL_ORDER: ProfileSocialTabId[] = [
	"lists",
	"favorites",
	"reviews",
];

function readLogWatchVenue(
	log: ProfileFilmographyRow["log"] & { watch_venue?: unknown },
): ProfileFilmographyRow["log"]["watchVenue"] {
	if (log.watchVenue === "theaters" || log.watchVenue === "streaming") {
		return log.watchVenue;
	}
	const raw = log.watch_venue;
	if (raw === "theaters" || raw === "streaming") return raw;
	return undefined;
}

/** One row per film or series — keeps the newest log when the patron rewatched a title. */
function filmographyFromRecentlyWatched(
	recentlyWatched: ProfileData["recentlyWatched"],
): ProfileFilmographyRow[] {
	const byKey = new Map<string, ProfileFilmographyRow>();
	for (const row of recentlyWatched) {
		const key = row.movie
			? `m:${row.movie.tmdbId}`
			: row.tv
				? `t:${row.tv.tmdbId}`
				: null;
		if (!key) continue;
		const existing = byKey.get(key);
		const nextTs = new Date(row.log.watchedAt).getTime();
		const prevTs = existing
			? new Date(existing.log.watchedAt).getTime()
			: Number.NEGATIVE_INFINITY;
		if (!existing || nextTs >= prevTs) {
			const log = row.log as ProfileFilmographyRow["log"] & {
				watch_venue?: unknown;
			};
			byKey.set(key, {
				...row,
				log: {
					...log,
					watchVenue: readLogWatchVenue(log),
				},
			});
		}
	}
	return [...byKey.values()].sort(
		(a, b) =>
			new Date(b.log.watchedAt).getTime() - new Date(a.log.watchedAt).getTime(),
	);
}

function profileInitials(displayName: string): string {
	const parts = displayName.trim().split(/\s+/).filter(Boolean);
	if (!parts.length) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	const a = parts[0][0];
	const b = parts[parts.length - 1][0];
	return `${a}${b}`.toUpperCase();
}

function splitFilmographyLedger(rows: ProfileFilmographyRow[]) {
	const movieRows = rows.filter((r) => r.movie != null);
	const tvRows = rows.filter((r) => r.tv != null);
	return { movieRows, tvRows };
}

function resolveProfileTab(
	raw: string | undefined,
	socialTabs: readonly ProfileSocialTabId[],
	movieRows: ProfileFilmographyRow[],
	tvRows: ProfileFilmographyRow[],
): ProfileTabId {
	let v = raw?.toLowerCase();
	// Legacy `?tab=filmography` → prefer Movies when the patron has film logs.
	if (v === "filmography") {
		v = movieRows.length > 0 ? "movies" : tvRows.length > 0 ? "tv" : "movies";
	}
	const available: ProfileTabId[] = ["movies", "tv", ...socialTabs];
	if (v && (available as readonly string[]).includes(v))
		return v as ProfileTabId;
	if (movieRows.length > 0) return "movies";
	if (tvRows.length > 0) return "tv";
	return socialTabs[0] ?? "movies";
}

function titleCountLineForTab(
	tab: ProfileTabId,
	movieCount: number,
	tvCount: number,
	favoritesOnly: boolean,
	reviewsCount: number,
	listsCount: number,
): string | null {
	if (tab === "favorites" && movieCount > 0) {
		return `${movieCount} favorite film${movieCount === 1 ? "" : "s"}`;
	}
	if (tab === "movies" && movieCount > 0) {
		return `${movieCount} film${movieCount === 1 ? "" : "s"} logged`;
	}
	if (tab === "tv" && tvCount > 0) {
		if (favoritesOnly) {
			return `${tvCount} favorite show${tvCount === 1 ? "" : "s"}`;
		}
		return `${tvCount} TV show${tvCount === 1 ? "" : "s"} logged`;
	}
	if (tab === "reviews" && reviewsCount > 0) {
		return `${reviewsCount} review${reviewsCount === 1 ? "" : "s"}`;
	}
	if (tab === "lists" && listsCount > 0) {
		return `${listsCount} list${listsCount === 1 ? "" : "s"}`;
	}
	return null;
}

export default async function ProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ handle: string }>;
	searchParams: Promise<{
		tab?: string;
		order?: string;
		venue?: string;
		favorites?: string;
	}>;
}) {
	const { handle } = await params;
	const sp = await searchParams;
	const session = await authServer();
	const api = await serverApi();
	const res = await api.api.profiles({ handle }).get();
	const data = res.data as ProfileData | null;
	if (!data) notFound();
	const { profile, user, stats } = data;
	const isMe = session?.user.id === user.id;

	const [badgesRes, achievementsRes] = await Promise.all([
		api.api.badges
			.of({ userId: user.id })
			.get()
			.catch(() => ({ data: [] })),
		api.api.achievements
			.of({ userId: user.id })
			.get()
			.catch(() => ({ data: [] })),
	]);
	const rawEarnedBadges =
		(badgesRes.data as unknown as ProfileEarnedBadge[]) ?? [];
	const earnedBadges = rawEarnedBadges
		.filter((row): row is ProfileEarnedBadge => row.badge != null)
		.slice(0, 8);
	const rawUnlockedAchievements =
		(achievementsRes.data as unknown as ProfileUnlockedAchievement[]) ?? [];
	const unlockedAchievements = rawUnlockedAchievements
		.filter((row): row is ProfileUnlockedAchievement => row.achievement != null)
		.slice(0, 8);

	const lobbyOrder = parseProfileLobbyOrder(sp.order);
	const lobbyVenue = parseProfileLobbyVenue(sp.venue);
	const favoritesOnly = parseProfileLobbyFavorites(sp.favorites);
	const allFilmographyRows = sortProfileFilmographyRows(
		filmographyFromRecentlyWatched(data.recentlyWatched),
		lobbyOrder,
	);
	const { movieRows: moviesAll, tvRows: tvAll } =
		splitFilmographyLedger(allFilmographyRows);

	if (sp.tab?.toLowerCase() === "favorites") {
		const ledgerTab =
			moviesAll.some((row) => row.log.liked) || tvAll.length === 0
				? "movies"
				: "tv";
		redirect(
			buildProfileLobbyHref({
				handle: profile.handle,
				tab: ledgerTab,
				order: lobbyOrder,
				venue: lobbyVenue,
				favoritesOnly: true,
			}),
		);
	}

	const venueFilteredRows = allFilmographyRows.filter((row) =>
		profileLogMatchesProfileLobbyVenue(row, lobbyVenue),
	);
	const filmographyRows = favoritesOnly
		? venueFilteredRows.filter((row) => row.log.liked)
		: venueFilteredRows;
	const { movieRows, tvRows } = splitFilmographyLedger(filmographyRows);
	const { movieRows: moviesVenueAll, tvRows: tvVenueAll } =
		splitFilmographyLedger(venueFilteredRows);
	const likedFilmographyCount = allFilmographyRows.filter(
		(row) => row.log.liked,
	).length;

	const socialTabs = PROFILE_TOOLBAR_SOCIAL_ORDER.filter((sec) => {
		if (sec === "favorites") return likedFilmographyCount > 0;
		if (sec === "reviews") return data.recentReviews.length > 0;
		if (sec === "lists") return data.lists.length > 0;
		return false;
	});

	const contentTab = resolveProfileTab(sp.tab, socialTabs, moviesAll, tvAll);
	const toolbarActiveTab: ProfileTabId =
		favoritesOnly && socialTabs.includes("favorites")
			? "favorites"
			: contentTab;
	const ledgerTab: ProfileLedgerTabId = contentTab === "tv" ? "tv" : "movies";

	let viewerPrefs: Record<string, unknown> | null = null;
	if (isMe) {
		const meRes = await api.api.profiles.me.get().catch(() => ({ data: null }));
		viewerPrefs =
			(meRes.data as { preferences?: Record<string, unknown> | null } | null)
				?.preferences ?? null;
	}
	const monochromePeersOnHover =
		readCatalogMonochromePeersOnHoverPref(viewerPrefs);

	const ledgerPosterKeys =
		contentTab === "movies"
			? movieRows.map((r) => r.log.id)
			: contentTab === "tv"
				? tvRows.map((r) => r.log.id)
				: [];
	const catalogueWaveKey =
		contentTab === "lists"
			? `lists:${data.lists.map((l) => l.id).join("|")}`
			: `${contentTab}:${lobbyOrder}:${lobbyVenue}:${favoritesOnly ? "fav" : "all"}:${ledgerPosterKeys.join("|")}`;

	const titleCountLine = titleCountLineForTab(
		toolbarActiveTab,
		movieRows.length,
		tvRows.length,
		favoritesOnly,
		data.recentReviews.length,
		data.lists.length,
	);

	const sharePath =
		contentTab === "movies" || contentTab === "tv"
			? buildProfileLobbyHref({
					handle: profile.handle,
					tab: contentTab,
					order: lobbyOrder,
					venue: lobbyVenue,
					favoritesOnly,
				})
			: `/profile/${encodeURIComponent(profile.handle)}?tab=${toolbarActiveTab}`;
	const switchVenue: HomeVenue =
		lobbyVenue === "theaters" ? "streaming" : "theaters";
	const switchVenueHref = buildProfileLobbyHref({
		handle: profile.handle,
		tab: ledgerTab,
		order: lobbyOrder,
		venue: switchVenue,
		favoritesOnly,
	});
	const showAllLedgerHref = buildProfileLobbyHref({
		handle: profile.handle,
		tab: ledgerTab,
		order: lobbyOrder,
		venue: lobbyVenue,
		favoritesOnly: false,
	});

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-visible bg-background">
			<ProfileTopBar displayName={profile.displayName} sharePath={sharePath} />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"min-h-0 flex-1 gap-4 overflow-visible p-6 sm:gap-5 sm:p-8",
				)}
			>
				<ProfilePatronHeader
					handle={profile.handle}
					displayName={profile.displayName}
					pronouns={profile.pronouns}
					bio={profile.bio}
					avatarUrl={user.image}
					initials={profileInitials(profile.displayName)}
					stats={stats}
					location={profile.location}
					website={profile.website}
					isMe={isMe}
					targetUserId={user.id}
					bannerUrl={profile.bannerUrl}
					accentColor={profile.accentColor}
					titleCountLine={titleCountLine}
				/>

				<ProfilePatronMilestones
					handle={profile.handle}
					earnedBadges={earnedBadges}
					unlockedAchievements={unlockedAchievements}
				/>

				<ProfileLobbyChrome
					handle={profile.handle}
					socialTabs={socialTabs}
					activeTab={toolbarActiveTab}
					ledgerTab={ledgerTab}
				/>

				<div className="min-h-0 flex-1">
					<ProfileTabPanels
						activeTab={contentTab}
						movieRows={movieRows}
						tvRows={tvRows}
						moviesAllCount={moviesAll.length}
						tvAllCount={tvAll.length}
						moviesVenueCount={moviesVenueAll.length}
						tvVenueCount={tvVenueAll.length}
						favoritesOnly={favoritesOnly}
						showAllLedgerHref={showAllLedgerHref}
						lobbyVenue={lobbyVenue}
						switchVenueHref={switchVenueHref}
						reviews={data.recentReviews}
						lists={data.lists}
						catalogueWaveKey={catalogueWaveKey}
						monochromePeersOnHover={monochromePeersOnHover}
					/>
				</div>
			</section>
		</div>
	);
}
