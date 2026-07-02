import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import {
	ProfileAboutCollapsible,
	ProfilePatronMetaLine,
} from "@/components/profile/profile-about-collapsible";
import { openProfileFollows } from "@/components/profile/profile-follows-drawer";
import { ProfilePatronActions } from "@/components/profile/profile-patron-actions";
import { ProfilePinnedReviewsStrip } from "@/components/profile/profile-pinned-reviews-strip";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { ProfileSavedQuotesStrip } from "@/components/profile/profile-saved-quotes-strip";
import { ProfileShowcaseStrip } from "@/components/profile/profile-showcase-strip";
import { ProfileStatCell } from "@/components/profile/profile-stat-cell";
import { ProfileStreakStatCell } from "@/components/profile/profile-streak-stat-cell";
import { ProfileTasteCategoryPill } from "@/components/profile/profile-taste-signature";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import {
	type ProfileBannerFrameId,
	profileBannerFrameClass,
} from "@/lib/profile-appearance";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import { profileMediaCacheKey } from "@/lib/profile-media-cache-key";
import type { ProfileShowcaseTile } from "@/lib/profile-showcase";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import type { TasteSignatureJson } from "@/lib/sense-taste-signature";

/** Hero portrait straddles the banner — half on canvas, half on card body. */
const PROFILE_HERO_PORTRAIT_CLASSNAME = "size-28 sm:size-32";
const PROFILE_HERO_PORTRAIT_IMAGE_PX = 128;

/** Horizontal gutters for lobby body content on `bg-card` (matches profile page `p-6 sm:p-8`). */
export const PROFILE_LOBBY_BODY_GUTTER_CLASSNAME = "px-6 sm:px-8";

type ProfilePatronHeaderProps = {
	handle: string;
	displayName: string;
	pronouns: string | null;
	bio: string | null;
	avatarUrl: string | null;
	initials: string;
	stats: { followers: number; following: number };
	location: string | null;
	website: string | null;
	birthdayDisplay?: string | null;
	isMe: boolean;
	targetUserId: string;
	bannerUrl: string | null;
	bannerFrame?: ProfileBannerFrameId;
	accentColor: string | null;
	/** Diary title counts for the stats grid (distinct films vs TV shows). */
	moviesCount: number;
	tvCount: number;
	tasteSignature?: TasteSignatureJson | null;
	pinnedReviews?: ProfileReviewRow[];
	showcaseItems?: ProfileShowcaseTile[];
	savedQuotesPreview?: SavedQuoteLobbyItem[];
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
	avatarIsAnimated?: boolean;
	bannerIsAnimated?: boolean;
	profilePortraitGrayscaleUntilHover?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
};

/**
 * Patron identity — wide banner, overlapping portrait, detail-motion CTAs.
 */
export function ProfilePatronHeader({
	handle,
	displayName,
	pronouns,
	bio,
	avatarUrl,
	initials,
	stats,
	location,
	website,
	birthdayDisplay,
	isMe,
	targetUserId,
	bannerUrl,
	bannerFrame = "none",
	accentColor,
	moviesCount,
	tvCount,
	tasteSignature,
	pinnedReviews = [],
	showcaseItems = [],
	savedQuotesPreview = [],
	canCompareTaste,
	initialTasteCompareOpen,
	avatarIsAnimated,
	bannerIsAnimated,
	profilePortraitGrayscaleUntilHover,
	diaryMetalTier = null,
}: ProfilePatronHeaderProps) {
	const accent = accentColor?.trim() || "#c45c26";
	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc = hasBanner
		? profileBannerImageUrl(handle, profileMediaCacheKey(bannerUrl))
		: null;
	const hasPortrait = Boolean(avatarUrl?.trim());
	const trimmedBio = bio?.trim() ?? "";

	return (
		<header className="relative mb-8 shrink-0">
			{/* Banner + portrait — PFP straddles the banner bottom (half on / half off). */}
			<div className="relative">
				<div
					className={cn(
						"relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25",
						profileBannerFrameClass(bannerFrame),
					)}
				>
					{bannerSrc ? (
						bannerIsAnimated ? (
							// Animated GIF/WebP must use native <img> so frames play.
							// biome-ignore lint/performance/noImgElement: Next Image does not animate GIF/WebP frames
							<img
								src={bannerSrc}
								alt=""
								className="absolute inset-0 size-full object-cover"
							/>
						) : (
							<Image
								src={bannerSrc}
								alt=""
								fill
								unoptimized
								className="object-cover"
								sizes="(max-width: 1280px) 100vw, 1200px"
								priority
							/>
						)
					) : (
						<div
							className="size-full"
							style={{
								background: `linear-gradient(120deg, ${accent}44, transparent 55%), var(--surface-card-base, var(--card))`,
							}}
							aria-hidden
						/>
					)}
					<div
						className="pointer-events-none absolute inset-0 bg-gradient-to-t from-card/90 via-card/20 to-transparent"
						aria-hidden
					/>
				</div>

				<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center">
					<div className="pointer-events-auto translate-y-1/2">
						<div className={cn("relative", PROFILE_HERO_PORTRAIT_CLASSNAME)}>
							<div
								className="pointer-events-none absolute inset-0 rounded-full bg-muted/30 shadow-lg ring-6 ring-card sm:ring-8"
								aria-hidden
							/>
							{hasPortrait ? (
								<PatronPortraitWithMetalTier
									handle={handle}
									avatarUrl={avatarUrl}
									name={displayName || initials}
									isAnimated={avatarIsAnimated}
									grayscaleUntilHover={
										profilePortraitGrayscaleUntilHover ?? true
									}
									className="size-full rounded-full"
									width={PROFILE_HERO_PORTRAIT_IMAGE_PX}
									height={PROFILE_HERO_PORTRAIT_IMAGE_PX}
									diaryMetalTier={diaryMetalTier}
								/>
							) : (
								<div className="size-full overflow-hidden rounded-full">
									<PersonCreditPortrait
										name={displayName || initials}
										profilePath={null}
										grayscale
										sizes="(max-width: 640px) 112px, 128px"
									/>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Ledger + social counts — compact pills directly under the banner. */}
			<div className="relative z-10 mt-5 flex min-h-11 items-center justify-between gap-3 sm:mt-6 sm:min-h-12">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<ProfileTasteCategoryPill
						tasteSignature={tasteSignature ?? null}
						perspective={isMe ? "self" : "visitor"}
					/>
					<ProfileStatCell variant="pill" value={moviesCount} label="films" />
					<ProfileStatCell variant="pill" value={tvCount} label="shows" />
				</div>
				<div className="flex min-w-0 flex-wrap justify-end gap-1.5">
					<ProfileStatCell
						variant="pill"
						value={stats.followers}
						label="followers"
						onClick={() =>
							openProfileFollows({ targetUserId, tab: "followers" })
						}
					/>
					<ProfileStatCell
						variant="pill"
						value={stats.following}
						label="following"
						onClick={() =>
							openProfileFollows({ targetUserId, tab: "following" })
						}
					/>
					{isMe ? <ProfileStreakStatCell handle={handle} /> : null}
				</div>
			</div>

			<div className="relative mx-auto max-w-lg px-2 pt-3 text-center sm:px-4">
				{/* Name */}
				<h1 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
					{displayName}
				</h1>

				{/* Handle */}
				<p className="mt-1 text-pretty text-muted-foreground text-sm">
					@{handle}
				</p>

				<ProfilePatronMetaLine
					pronouns={pronouns}
					location={location}
					website={website}
					birthdayDisplay={birthdayDisplay}
				/>

				{/* Bio — compact pill directly under identity meta */}
				{trimmedBio ? (
					<p className="mx-auto mt-3 max-w-md text-pretty rounded-full bg-background px-4 py-2.5 text-foreground/85 text-sm leading-snug">
						{trimmedBio}
					</p>
				) : null}

				<ProfilePatronActions
					isMe={isMe}
					targetUserId={targetUserId}
					handle={handle}
					canCompareTaste={canCompareTaste}
					initialTasteCompareOpen={initialTasteCompareOpen}
				/>

				<ProfileShowcaseStrip
					handle={handle}
					isMe={isMe}
					items={showcaseItems}
					className="mt-4"
				/>

				<ProfileSavedQuotesStrip
					handle={handle}
					items={savedQuotesPreview}
					isMe={isMe}
					showViewAll={isMe}
				/>

				{/* Diary heatmap — meta lives under @handle in the hero block above */}
				<ProfileAboutCollapsible
					handle={handle}
					bio={null}
					pronouns={pronouns}
					location={location}
					website={website}
					birthdayDisplay={birthdayDisplay}
					hideActivitySignature={isMe}
					hideMeta
				/>

				{/* Pinned reviews */}
				<ProfilePinnedReviewsStrip rows={pinnedReviews} />
			</div>
		</header>
	);
}
