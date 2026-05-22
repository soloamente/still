import Image from "next/image";

import { PersonCreditPortrait } from "@/components/movie/person-credit-portrait";
import { PatronPortraitAvatar } from "@/components/profile/patron-portrait-avatar";
import { ProfilePatronActions } from "@/components/profile/profile-patron-actions";
import { profileBannerImageUrl } from "@/lib/profile-banner";

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
	accentColor: string | null;
	/** Shown under the bio — e.g. filmography count for the active ledger tab. */
	titleCountLine?: string | null;
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
	accentColor,
	titleCountLine,
}: ProfilePatronHeaderProps) {
	const accent = accentColor?.trim() || "#c45c26";
	const hasBanner = Boolean(bannerUrl?.trim());
	const bannerSrc = hasBanner ? profileBannerImageUrl(handle) : null;
	const hasPortrait = Boolean(avatarUrl?.trim());

	return (
		<header className="relative mb-8 shrink-0">
			<div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-muted/25">
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

				<h1 className="text-balance font-semibold text-foreground text-xl sm:text-2xl">
					{displayName}
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">@{handle}</p>
				{pronouns ? (
					<p className="mt-1 text-muted-foreground text-xs">{pronouns}</p>
				) : null}
				{bio ? (
					<p className="mt-3 text-balance font-editorial text-muted-foreground text-sm leading-relaxed">
						{bio}
					</p>
				) : null}
				{titleCountLine ? (
					<p className="mt-3 text-muted-foreground text-sm tabular-nums">
						{titleCountLine}
					</p>
				) : null}

				<p className="mt-3 text-muted-foreground text-sm tabular-nums">
					<span className="font-medium text-foreground">{stats.followers}</span>{" "}
					followers
					<span aria-hidden className="mx-2">
						·
					</span>
					<span className="font-medium text-foreground">{stats.following}</span>{" "}
					following
				</p>

				{location || website ? (
					<p className="mt-2 text-muted-foreground text-xs">
						{location ? <span>{location}</span> : null}
						{location && website ? (
							<span aria-hidden className="mx-2">
								·
							</span>
						) : null}
						{website ? (
							<a
								href={website}
								target="_blank"
								rel="noopener noreferrer"
								className="text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
							>
								{website.replace(/^https?:\/\//, "")}
							</a>
						) : null}
					</p>
				) : null}

				<ProfilePatronActions isMe={isMe} targetUserId={targetUserId} />
			</div>
		</header>
	);
}
