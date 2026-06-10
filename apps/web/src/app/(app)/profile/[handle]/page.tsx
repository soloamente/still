import { notFound, redirect } from "next/navigation";

import { ProfilePatronLobbyShell } from "@/components/profile/profile-patron-lobby-shell";
import type {
	ProfileEarnedBadge,
	ProfileUnlockedAchievement,
} from "@/components/profile/profile-patron-milestones";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import type { ProfileSocialTabId } from "@/components/profile/profile-tab-toolbar";
import { authServer } from "@/lib/auth-server";
import { pickProfileShowcaseBadges } from "@/lib/badge-prestige";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { fetchProfileFilmographyServer } from "@/lib/fetch-profile-filmography-server";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	OG_DEFAULT_PATH,
	ogImageMetadataFields,
	ogTastePath,
} from "@/lib/og/og-image-metadata";
import { readProfileBannerFramePref } from "@/lib/profile-appearance";
import {
	buildProfileLobbyHref,
	parseProfileLobbyFavorites,
	parseProfileLobbyOrder,
	parseProfileLobbyVenue,
} from "@/lib/profile-lobby-order";
import { inferAnimatedFromProfileUrl } from "@/lib/profile-media";
import {
	readAvatarIsAnimatedPref,
	readBannerIsAnimatedPref,
	readCatalogMonochromePeersOnHoverPref,
	readProfilePortraitGrayscaleUntilHoverPref,
} from "@/lib/profile-preferences";
import { parseTasteSignatureJson } from "@/lib/sense-taste-signature";
import { serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ handle: string }>;
}) {
	const { handle } = await params;
	const normalized = handle.toLowerCase();
	const title = `@${normalized}`;

	try {
		const api = await serverApi();
		const res = await api.api.profiles({ handle: normalized }).get();
		const data = res.data as {
			profile?: { displayName?: string; isPrivate?: boolean };
			user?: { name?: string | null };
		} | null;
		const isPrivate = data?.profile?.isPrivate === true;
		const displayName = data?.profile?.displayName ?? data?.user?.name ?? title;

		if (isPrivate) {
			return {
				title,
				...ogImageMetadataFields(OG_DEFAULT_PATH, displayName),
			};
		}

		return {
			title,
			...ogImageMetadataFields(ogTastePath(normalized), displayName),
		};
	} catch {
		return {
			title,
			...ogImageMetadataFields(ogTastePath(normalized), title),
		};
	}
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
		birthdayDisplay?: string;
		accentColor: string | null;
		preferences?: Record<string, unknown> | null;
		favoriteMovieIds: number[];
		sectionOrder: string[] | null;
		isPrivate: boolean;
		tasteSignature?: unknown;
		diaryMetalTier?: DiaryMetalTier | null;
	};
	stats: { followers: number; following: number };
	creator?: { isCurator: boolean; headline: string | null };
	isFollowing: boolean;
	filmographyCounts: {
		movies: number;
		tv: number;
		likedMovies: number;
		likedTv: number;
	};
	recentReviews: ProfileReviewRow[];
	pinnedReviews: ProfileReviewRow[];
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
	earnedBadges: ProfileEarnedBadge[];
	unlockedAchievements: ProfileUnlockedAchievement[];
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
		/** Opens taste overlap sheet — used by taste challenge notifications. */
		tasteCompare?: string;
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

	// Badges + achievements are folded into the profile payload above, so the
	// page renders from a single server round trip instead of chaining calls.
	const earnedBadges = pickProfileShowcaseBadges(
		(data.earnedBadges ?? []).filter(
			(row): row is ProfileEarnedBadge => row.badge != null,
		),
		8,
	);
	const unlockedAchievements = (data.unlockedAchievements ?? [])
		.filter((row): row is ProfileUnlockedAchievement => row.achievement != null)
		.slice(0, 8);

	const lobbyOrder = parseProfileLobbyOrder(sp.order);
	const lobbyVenue = parseProfileLobbyVenue(sp.venue);
	const counts = data.filmographyCounts;

	// favorites tab → ledger redirect (now off counts).
	if (sp.tab?.toLowerCase() === "favorites") {
		const ledgerTab =
			counts.likedMovies > 0 || counts.tv === 0 ? "movies" : "tv";
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

	const favoritesOnly = parseProfileLobbyFavorites(sp.favorites);
	const activeMedia: "movie" | "tv" =
		sp.tab?.toLowerCase() === "tv"
			? "tv"
			: sp.tab?.toLowerCase() === "movies"
				? "movie"
				: counts.movies > 0
					? "movie"
					: counts.tv > 0
						? "tv"
						: "movie";
	const orderToken: "latest" | "earliest" | "title" =
		lobbyOrder === "earliest_seen"
			? "earliest"
			: lobbyOrder === "title_az"
				? "title"
				: "latest";

	const filmographyPage1 = await fetchProfileFilmographyServer(profile.handle, {
		media: activeMedia,
		order: orderToken,
		venue: lobbyVenue,
		favorites: favoritesOnly,
	});

	const socialTabs = PROFILE_TOOLBAR_SOCIAL_ORDER.filter((sec) => {
		if (sec === "favorites") return counts.likedMovies + counts.likedTv > 0;
		if (sec === "reviews")
			return (
				data.recentReviews.length > 0 || (data.pinnedReviews?.length ?? 0) > 0
			);
		if (sec === "lists") return data.lists.length > 0;
		return false;
	});

	// When viewing your own profile the payload already carries your prefs, so
	// skip the extra /profiles/me round trip that previously ran here.
	const viewerPrefs: Record<string, unknown> | null = isMe
		? (profile.preferences ?? null)
		: null;
	const monochromePeersOnHover =
		readCatalogMonochromePeersOnHoverPref(viewerPrefs);
	const tasteSignature = parseTasteSignatureJson(profile.tasteSignature);
	const canCompareTaste = Boolean(session?.user.id && !isMe);
	const initialTasteCompareOpen =
		canCompareTaste && (sp.tasteCompare === "1" || sp.tasteCompare === "true");
	const bannerFrame = readProfileBannerFramePref(profile.preferences ?? null);
	const avatarUrl = user.image;
	const bannerUrl = profile.bannerUrl;
	const avatarFlag = readAvatarIsAnimatedPref(profile.preferences);
	const bannerFlag = readBannerIsAnimatedPref(profile.preferences);
	const avatarIsAnimated = inferAnimatedFromProfileUrl(avatarUrl, avatarFlag);
	const bannerIsAnimated = inferAnimatedFromProfileUrl(bannerUrl, bannerFlag);
	const profilePortraitGrayscaleUntilHover =
		readProfilePortraitGrayscaleUntilHoverPref(profile.preferences);

	return (
		<ProfilePatronLobbyShell
			handle={profile.handle}
			displayName={profile.displayName}
			pronouns={profile.pronouns}
			bio={profile.bio}
			avatarUrl={avatarUrl}
			stats={stats}
			location={profile.location}
			website={profile.website}
			birthdayDisplay={profile.birthdayDisplay ?? null}
			isMe={isMe}
			targetUserId={user.id}
			viewerId={session?.user.id ?? null}
			bannerUrl={bannerUrl}
			bannerFrame={bannerFrame}
			accentColor={profile.accentColor}
			seeds={filmographyPage1.seeds}
			totalPages={filmographyPage1.totalPages}
			totalResults={filmographyPage1.totalResults}
			venueCounts={filmographyPage1.venueCounts}
			filmographyCounts={counts}
			recentReviews={data.recentReviews}
			pinnedReviews={data.pinnedReviews ?? []}
			lists={data.lists.map((l) => toListBoardRow(l))}
			socialTabs={socialTabs}
			earnedBadges={earnedBadges}
			unlockedAchievements={unlockedAchievements}
			monochromePeersOnHover={monochromePeersOnHover}
			tasteSignature={tasteSignature}
			canCompareTaste={canCompareTaste}
			initialTasteCompareOpen={initialTasteCompareOpen}
			curatorHeadline={data.creator?.headline ?? null}
			avatarIsAnimated={avatarIsAnimated}
			bannerIsAnimated={bannerIsAnimated}
			profilePortraitGrayscaleUntilHover={profilePortraitGrayscaleUntilHover}
			diaryMetalTier={profile.diaryMetalTier ?? null}
		/>
	);
}
