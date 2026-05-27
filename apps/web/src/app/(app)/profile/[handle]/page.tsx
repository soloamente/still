import { notFound, redirect } from "next/navigation";

import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
import { ProfilePatronLobbyShell } from "@/components/profile/profile-patron-lobby-shell";
import type {
	ProfileEarnedBadge,
	ProfileUnlockedAchievement,
} from "@/components/profile/profile-patron-milestones";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import type { ProfileSocialTabId } from "@/components/profile/profile-tab-toolbar";
import { authServer } from "@/lib/auth-server";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	filmographyFromRecentlyWatched,
	splitProfileFilmographyLedger,
} from "@/lib/profile-lobby-derive";
import {
	buildProfileLobbyHref,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
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
	recentlyWatched: ProfileFilmographyRow[];
	recentReviews: ProfileReviewRow[];
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
	pinnedBadges: { badgeId: string; awardedAt: string }[];
};

const PROFILE_TOOLBAR_SOCIAL_ORDER: ProfileSocialTabId[] = [
	"lists",
	"favorites",
	"reviews",
];

export default async function ProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ handle: string }>;
	searchParams: Promise<{
		tab?: string;
		order?: string;
		favorites?: string;
		venue?: string;
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
	const allFilmographyRows = filmographyFromRecentlyWatched(
		data.recentlyWatched,
	);
	const { movieRows: moviesAll, tvRows: tvAll } =
		splitProfileFilmographyLedger(allFilmographyRows);

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

	const likedFilmographyCount = allFilmographyRows.filter(
		(row) => row.log.liked,
	).length;

	const socialTabs = PROFILE_TOOLBAR_SOCIAL_ORDER.filter((sec) => {
		if (sec === "favorites") return likedFilmographyCount > 0;
		if (sec === "reviews") return data.recentReviews.length > 0;
		if (sec === "lists") return data.lists.length > 0;
		return false;
	});

	let viewerPrefs: Record<string, unknown> | null = null;
	if (isMe) {
		const meRes = await api.api.profiles.me.get().catch(() => ({ data: null }));
		viewerPrefs =
			(meRes.data as { preferences?: Record<string, unknown> | null } | null)
				?.preferences ?? null;
	}
	const monochromePeersOnHover =
		readCatalogMonochromePeersOnHoverPref(viewerPrefs);

	return (
		<ProfilePatronLobbyShell
			handle={profile.handle}
			displayName={profile.displayName}
			pronouns={profile.pronouns}
			bio={profile.bio}
			avatarUrl={user.image}
			stats={stats}
			location={profile.location}
			website={profile.website}
			isMe={isMe}
			targetUserId={user.id}
			bannerUrl={profile.bannerUrl}
			accentColor={profile.accentColor}
			recentlyWatched={data.recentlyWatched}
			recentReviews={data.recentReviews}
			lists={data.lists.map((l) => toListBoardRow(l))}
			socialTabs={socialTabs}
			earnedBadges={earnedBadges}
			unlockedAchievements={unlockedAchievements}
			monochromePeersOnHover={monochromePeersOnHover}
		/>
	);
}
