import { cn } from "@still/ui/lib/utils";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PatronPortraitWithMetalTier } from "@/components/profile/patron-portrait-with-metal-tier";
import {
	ProfileAboutCollapsible,
	ProfilePatronMetaLine,
} from "@/components/profile/profile-about-collapsible";
import { openProfileFollows } from "@/components/profile/profile-follows-drawer";
import { ProfileHeroMediaLayer } from "@/components/profile/profile-hero-media-layer";
import { ProfilePatronActions } from "@/components/profile/profile-patron-actions";
import { ProfilePinnedReviewsStrip } from "@/components/profile/profile-pinned-reviews-strip";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { ProfileSavedQuotesStrip } from "@/components/profile/profile-saved-quotes-strip";
import { ProfileShowcaseStrip } from "@/components/profile/profile-showcase-strip";
import { ProfileStatCell } from "@/components/profile/profile-stat-cell";
import { ProfileStreakStatCell } from "@/components/profile/profile-streak-stat-cell";
import { ProfileTasteCategoryPill } from "@/components/profile/profile-taste-signature";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import type { ProfileBannerFrameId } from "@/lib/profile-appearance";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import {
	PROFILE_HERO_BAND_CLASSNAME,
	PROFILE_HERO_LOWER_HALF_SLOT_CLASSNAME,
	PROFILE_HERO_PORTRAIT_SHADOW_CLASSNAME,
	PROFILE_HERO_PORTRAIT_STRADDLE_CLASSNAME,
	PROFILE_HERO_STAT_ROW_OVERLAY_CLASSNAME,
} from "@/lib/profile-hero-layout";
import { profileMediaCacheKey } from "@/lib/profile-media-cache-key";
import type { ProfileShowcaseTile } from "@/lib/profile-showcase";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import type { TasteSignatureJson } from "@/lib/sense-taste-signature";

/** Hero portrait straddles the banner — half on canvas, half on card body. */
const PROFILE_HERO_PORTRAIT_CLASSNAME = "size-28 sm:size-32";
const PROFILE_HERO_PORTRAIT_IMAGE_PX = 128;

/**
 * Flanking stat pills must stay out of the portrait column (half width + shadow + gap).
 * On very narrow viewports we stack pills below the portrait instead — see stat row classes.
 */
const PROFILE_STAT_FLANK_MAX_WIDTH_CLASSNAME =
	"max-w-[calc(50%-4rem)] sm:max-w-[calc(50%-4.5rem)]";

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
	pinnedQuoteSaveIds?: string[];
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
	avatarIsAnimated?: boolean;
	bannerIsAnimated?: boolean;
	profilePortraitGrayscaleUntilHover?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
	/** Profile owner has Attuned activity signature entitlement. */
	activitySignatureEnabled?: boolean;
};

/**
 * Patron identity — full-bleed banner backdrop, overlapping portrait, detail-motion CTAs.
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
	pinnedQuoteSaveIds = [],
	canCompareTaste,
	initialTasteCompareOpen,
	avatarIsAnimated,
	bannerIsAnimated,
	profilePortraitGrayscaleUntilHover,
	diaryMetalTier = null,
	activitySignatureEnabled = true,
}: ProfilePatronHeaderProps) {
	const accent = accentColor?.trim() || "#c45c26";
	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc = hasBanner
		? profileBannerImageUrl(handle, profileMediaCacheKey(bannerUrl))
		: null;
	const hasPortrait = Boolean(avatarUrl?.trim());
	const trimmedBio = bio?.trim() ?? "";

	const portraitNode = (
		<div
			className={cn(
				"relative z-20 overflow-visible",
				PROFILE_HERO_PORTRAIT_CLASSNAME,
			)}
		>
			{/* Card-colored glow — wraps evenly around the portrait */}
			<div className={PROFILE_HERO_PORTRAIT_SHADOW_CLASSNAME} aria-hidden />
			{hasPortrait ? (
				<PatronPortraitWithMetalTier
					handle={handle}
					avatarUrl={avatarUrl}
					name={displayName || initials}
					isAnimated={avatarIsAnimated}
					grayscaleUntilHover={profilePortraitGrayscaleUntilHover ?? true}
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
	);

	return (
		<header className="relative isolate mb-8 shrink-0 overflow-visible">
			<div className="relative z-10 overflow-visible">
				{/* Banner floor — media bottom + PFP center both pin here */}
				<div className={cn(PROFILE_HERO_BAND_CLASSNAME, "overflow-visible")}>
					<ProfileHeroMediaLayer
						bannerSrc={bannerSrc}
						bannerIsAnimated={bannerIsAnimated}
						accent={accent}
						bannerFrame={bannerFrame}
					/>
					<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center">
						<div
							className={cn(
								"pointer-events-auto",
								PROFILE_HERO_PORTRAIT_STRADDLE_CLASSNAME,
							)}
						>
							{portraitNode}
						</div>
					</div>
				</div>

				{/* Stat pills — taste chip on the left flank; social stats on the right */}
				<div
					className={cn(
						PROFILE_HERO_LOWER_HALF_SLOT_CLASSNAME,
						"max-[400px]:h-auto max-[400px]:min-h-14",
					)}
				>
					<div
						className={cn(
							PROFILE_HERO_STAT_ROW_OVERLAY_CLASSNAME,
							"max-[400px]:relative max-[400px]:flex max-[400px]:flex-col max-[400px]:items-center max-[400px]:gap-2 max-[400px]:py-2",
						)}
					>
						<div
							className={cn(
								"pointer-events-auto flex min-w-0 flex-wrap items-center gap-1.5",
								PROFILE_STAT_FLANK_MAX_WIDTH_CLASSNAME,
								"max-[400px]:max-w-none max-[400px]:justify-center",
							)}
						>
							{tasteSignature ? (
								<ProfileTasteCategoryPill
									tasteSignature={tasteSignature}
									perspective={isMe ? "self" : "visitor"}
								/>
							) : null}
							<ProfileStatCell
								variant="pill"
								value={moviesCount}
								label="films"
							/>
							<ProfileStatCell variant="pill" value={tvCount} label="shows" />
						</div>
						<div
							className={cn(
								"pointer-events-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5",
								PROFILE_STAT_FLANK_MAX_WIDTH_CLASSNAME,
								"max-[400px]:max-w-none max-[400px]:justify-center",
							)}
						>
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
							<ProfileStreakStatCell
								handle={handle}
								isMe={isMe}
								activitySignatureEnabled={activitySignatureEnabled}
							/>
						</div>
					</div>
				</div>

				<div className="relative mx-auto max-w-lg px-2 pt-3 text-center sm:px-4">
					{/* Name */}
					<h1 className="text-balance font-semibold text-foreground text-xl leading-none sm:text-2xl">
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
						<p className="mx-auto mt-3 w-fit max-w-md text-balance rounded-2xl bg-background px-4 py-2.5 text-foreground/85 text-sm leading-snug">
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
						pinnedSaveIds={pinnedQuoteSaveIds}
						isMe={isMe}
						showViewAll={isMe}
					/>

					{/* About extras — diary rhythm lives in the streak pill popover */}
					<ProfileAboutCollapsible
						handle={handle}
						bio={null}
						pronouns={pronouns}
						location={location}
						website={website}
						birthdayDisplay={birthdayDisplay}
						hideActivitySignature
						hideMeta
					/>

					{/* Pinned reviews */}
					<ProfilePinnedReviewsStrip rows={pinnedReviews} />
				</div>
			</div>
		</header>
	);
}
