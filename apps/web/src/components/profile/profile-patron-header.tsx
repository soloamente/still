import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { ProfileAboutCollapsible } from "@/components/profile/profile-about-collapsible";
import { ProfileCuratorBadge } from "@/components/profile/profile-curator-badge";
import { ProfileFollowsTrigger } from "@/components/profile/profile-follows-drawer";
import { ProfilePatronActions } from "@/components/profile/profile-patron-actions";
import { ProfilePinnedReviewsStrip } from "@/components/profile/profile-pinned-reviews-strip";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { ProfileStreakStatCell } from "@/components/profile/profile-streak-stat-cell";
import { ProfileTasteSignature } from "@/components/profile/profile-taste-signature";
import {
	type ProfileBannerFrameId,
	profileBannerFrameClass,
} from "@/lib/profile-appearance";
import { profileBannerImageUrl } from "@/lib/profile-banner";
import type { TasteSignatureJson } from "@/lib/sense-taste-signature";

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
	isMe: boolean;
	targetUserId: string;
	bannerUrl: string | null;
	bannerFrame?: ProfileBannerFrameId;
	accentColor: string | null;
	/** Total logged films count across both tabs — for the stats grid. */
	filmCount: number;
	tasteSignature?: TasteSignatureJson | null;
	pinnedReviews?: ProfileReviewRow[];
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
	isCurator?: boolean;
	curatorHeadline?: string | null;
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
	isMe,
	targetUserId,
	bannerUrl,
	bannerFrame = "none",
	accentColor,
	filmCount,
	tasteSignature,
	pinnedReviews = [],
	canCompareTaste,
	initialTasteCompareOpen,
	isCurator = false,
	curatorHeadline = null,
}: ProfilePatronHeaderProps) {
	const accent = accentColor?.trim() || "#c45c26";
	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc = hasBanner ? profileBannerImageUrl(handle) : null;
	const hasPortrait = Boolean(avatarUrl?.trim());

	return (
		<header className="relative mb-8 shrink-0">
			<div
				className={cn(
					"relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25",
					profileBannerFrameClass(bannerFrame),
				)}
			>
				{bannerSrc ? (
					<Image
						src={bannerSrc}
						alt=""
						fill
						unoptimized
						className="object-cover"
						sizes="(max-width: 1280px) 100vw, 1200px"
						priority
					/>
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

			<div className="relative mx-auto -mt-14 max-w-md px-2 text-center sm:-mt-16 sm:px-4">
				{/* Portrait */}
				<div className="mx-auto mb-4 flex justify-center">
					<div className="relative aspect-[2/3] w-[5.5rem] overflow-hidden rounded-2xl bg-muted/30 shadow-lg ring-4 ring-card sm:w-24">
						{hasPortrait ? (
							<PatronPortraitAvatar
								handle={handle}
								avatarUrl={avatarUrl}
								name={displayName || initials}
								width={192}
								height={288}
								className="size-full rounded-2xl grayscale [@media(hover:hover)]:hover:grayscale-0"
							/>
						) : (
							<PersonCreditPortrait
								name={displayName || initials}
								profilePath={null}
								grayscale
								sizes="96px"
							/>
						)}
					</div>
				</div>

				{/* Name */}
				<h1 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
					{displayName}
				</h1>

				{/* Handle + curator chip inline */}
				<div className="mt-1 flex items-center justify-center gap-2">
					<p className="text-muted-foreground text-sm">@{handle}</p>
					{isCurator ? (
						<ProfileCuratorBadge headline={curatorHeadline} />
					) : null}
				</div>

				{/* Taste signature */}
				<ProfileTasteSignature
					tasteSignature={tasteSignature ?? null}
					className="mt-3"
				/>

				{/* Stats grid */}
				<div
					className={cn(
						"mt-4 grid gap-2",
						isMe ? "grid-cols-3" : "grid-cols-2",
					)}
				>
					<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
						<span className="font-semibold text-foreground text-sm tabular-nums">
							{filmCount}
						</span>
						<span className="text-[10px] text-muted-foreground">films</span>
					</div>

					{/* Merged followers+following cell */}
					<div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/20 py-2.5">
						<ProfileFollowsTrigger
							targetUserId={targetUserId}
							followers={stats.followers}
							following={stats.following}
						/>
					</div>

					{isMe ? (
						<div className="flex flex-col items-center justify-center rounded-xl bg-muted/20 py-2.5">
							<ProfileStreakStatCell />
						</div>
					) : null}
				</div>

				{/* Actions */}
				<ProfilePatronActions
					isMe={isMe}
					targetUserId={targetUserId}
					handle={handle}
					canCompareTaste={canCompareTaste}
					initialTasteCompareOpen={initialTasteCompareOpen}
				/>

				{/* Collapsible: bio, pronouns, location, website, heatmap */}
				<ProfileAboutCollapsible
					handle={handle}
					bio={bio}
					pronouns={pronouns}
					location={location}
					website={website}
				/>

				{/* Pinned reviews */}
				<ProfilePinnedReviewsStrip rows={pinnedReviews} />
			</div>
		</header>
	);
}
