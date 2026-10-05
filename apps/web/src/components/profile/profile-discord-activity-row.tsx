"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@still/ui/components/tooltip";
import IconAppleMusic from "@still/ui/icons/apple-music";
import IconSpotifyBrand from "@still/ui/icons/spotify-brand";
import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { DiscordActivityProgressBar } from "@/components/profile/discord-activity-progress-bar";
import {
	companionLivePositionSec,
	DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME,
	discordActivityHeadline,
	formatCompanionClock,
} from "@/lib/discord-activity-display";
import {
	type DiscordListeningBrand,
	discordListeningBrandLabel,
	discordListeningBrandTheme,
	resolveDiscordListeningBrand,
} from "@/lib/discord-activity-listening-brand";
import type { ProfileDiscordActivity } from "@/lib/fetch-profile-discord-activity-client";
import { hexWithAlpha } from "@/lib/hex-with-alpha";
import { useTextStateSwap } from "@/lib/text-state-swap";
import { useSoftwareGpuRendering } from "@/lib/use-software-gpu-rendering";

type ProfileDiscordActivityRowProps = {
	activity: ProfileDiscordActivity;
	className?: string;
};

function DiscordActivityArtwork({
	imageUrl,
	headline,
	albumName,
	creatorName,
	creatorImageUrl,
}: {
	imageUrl: string;
	headline: string;
	albumName?: string;
	creatorName?: string;
	creatorImageUrl?: string | null;
}) {
	const [showVinyl, setShowVinyl] = useState(false);
	const albumLabel = albumName?.trim() || headline;
	const trimmedCreatorName = creatorName?.trim() || null;
	const trimmedCreatorImageUrl = creatorImageUrl?.trim() || null;
	const actionLabel = showVinyl
		? `Show ${headline} album cover`
		: `Show ${headline} as a spinning vinyl`;

	return (
		<TooltipProvider delay={280} closeDelay={80}>
			<div className="relative aspect-square h-full min-h-20 w-auto justify-self-start">
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								aria-label={actionLabel}
								aria-pressed={showVinyl}
								onClick={() => setShowVinyl((current) => !current)}
								className={cn(
									"absolute inset-0 select-none overflow-hidden rounded-lg outline-none",
									"transition-transform duration-150 ease-out active:scale-[0.96]",
									"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME,
								)}
							>
								{/* Keep both faces mounted so repeated clicks retarget the transition smoothly. */}
								<span
									aria-hidden
									className={cn(
										"absolute inset-0 transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-opacity motion-reduce:duration-200",
										showVinyl
											? "scale-[0.94] opacity-0 blur-xs"
											: "scale-100 opacity-100 blur-0",
									)}
								>
									<Image
										src={imageUrl}
										alt=""
										fill
										sizes="128px"
										className="object-cover"
										unoptimized
									/>
								</span>

								<span
									aria-hidden
									className={cn(
										"absolute inset-0 flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-opacity motion-reduce:duration-200",
										showVinyl
											? "scale-100 opacity-100 blur-0"
											: "scale-[0.94] opacity-0 blur-xs",
									)}
								>
									{/* Reference-inspired flat disc: circular artwork + center label, without realistic grooves. */}
									<span
										className={cn(
											"relative size-full overflow-hidden rounded-full bg-[#111]",
											showVinyl &&
												"animate-[spin_3s_linear_infinite] motion-reduce:animate-none",
										)}
									>
										<Image
											src={imageUrl}
											alt=""
											fill
											sizes="128px"
											className="object-cover"
											unoptimized
										/>
										<span className="absolute inset-[42%] rounded-full bg-[#171717]" />
									</span>
								</span>
							</button>
						}
					/>
					<TooltipContent className="px-2 py-2 text-xs leading-none">
						{albumLabel}
					</TooltipContent>
				</Tooltip>

				{trimmedCreatorName && trimmedCreatorImageUrl ? (
					<Tooltip>
						<TooltipTrigger
							render={
								<button
									type="button"
									aria-label={trimmedCreatorName}
									className={cn(
										"absolute -right-1 -bottom-1 z-20 size-8 overflow-hidden rounded-full bg-background p-0.5",
										"outline-none transition-transform duration-150 ease-out active:scale-[0.96]",
										"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
									)}
								>
									<span className="relative block size-full overflow-hidden rounded-full">
										<Image
											src={trimmedCreatorImageUrl}
											alt=""
											fill
											sizes="32px"
											className="object-cover"
											unoptimized
										/>
									</span>
								</button>
							}
						/>
						<TooltipContent className="px-2 py-2 text-xs leading-none">
							{trimmedCreatorName}
						</TooltipContent>
					</Tooltip>
				) : null}
			</div>
		</TooltipProvider>
	);
}

function DiscordListeningBrandIcon({
	brand,
	className,
}: {
	brand: DiscordListeningBrand;
	className?: string;
}) {
	const label = discordListeningBrandLabel(brand);

	let icon: ReactNode;
	switch (brand) {
		case "spotify":
			icon = <IconSpotifyBrand size={18} className={className} />;
			break;
		case "apple_music":
			icon = <IconAppleMusic size={18} className={className} />;
			break;
		default: {
			const _exhaustive: never = brand;
			icon = _exhaustive;
		}
	}

	return (
		<TooltipProvider delay={280} closeDelay={80}>
			<Tooltip>
				<TooltipTrigger
					render={
						<button
							type="button"
							className={cn(
								"inline-flex shrink-0 appearance-none rounded-sm border-0 bg-transparent p-0",
								"outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
							)}
							aria-label={label}
						>
							{icon}
						</button>
					}
				/>
				<TooltipContent side="top" className="px-2 py-2 text-xs leading-none">
					{label}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

/** Header above the title. Discord writes "Watching with Sense" while it plays. */
function companionStatusWord(
	activity: ProfileDiscordActivity,
): "Watching with Sense" | "Paused" | "Browsing" {
	const detail = activity.detail?.trim() ?? "";
	const label = activity.label.trim();
	if (activity.paused === true || detail === "Paused") return "Paused";
	if (/^browsing\b/i.test(detail) || /^browsing\b/i.test(label))
		return "Browsing";
	return "Watching with Sense";
}

/** Episode row under the title (S4 E1 - Chapter One). */
function companionEpisodeLine(activity: ProfileDiscordActivity): string | null {
	const detail = activity.detail?.trim() ?? "";
	if (!detail || detail === "Paused" || /^browsing\b/i.test(detail)) {
		return null;
	}
	return detail;
}

/** Third row: On Netflix, On HBO Max, etc. */
function companionPlatformLine(
	activity: ProfileDiscordActivity,
): string | null {
	const service = activity.source?.trim();
	return service ? `On ${service}` : null;
}

/**
 * Advance a playing snapshot once a second.
 * The first paint stays on the raw sample so server and client markup match.
 * After mount, elapsed time since `sampledAt` is added on every tick.
 */
function useCompanionPlayhead(
	positionSec: number,
	durationSec: number,
	sampledAt: string | undefined,
	playing: boolean,
): number {
	const [nowMs, setNowMs] = useState<number | null>(null);
	// Used only when the payload has no sample time: start from this check.
	const localSample = useRef({ positionSec, at: 0 });

	useEffect(() => {
		if (!playing) return;
		const tick = () => {
			const now = Date.now();
			const sample = localSample.current;
			if (sample.positionSec !== positionSec || sample.at === 0) {
				localSample.current = { positionSec, at: now };
			}
			setNowMs(now);
		};
		tick();
		const id = window.setInterval(tick, 1000);
		function handleVisibilityChange() {
			if (document.visibilityState === "visible") tick();
		}
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.clearInterval(id);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [playing, positionSec]);

	if (!playing || nowMs == null) {
		return Math.min(durationSec, Math.max(0, positionSec));
	}
	const parsed = sampledAt ? Date.parse(sampledAt) : Number.NaN;
	const sampledAtMs = Number.isFinite(parsed)
		? parsed
		: localSample.current.at || nowMs;
	return companionLivePositionSec({
		positionSec,
		durationSec,
		playing,
		sampledAtMs,
		nowMs,
	});
}

function CompanionPlayback({
	positionSec,
	durationSec,
	sampledAt,
	playing,
}: {
	positionSec: number;
	durationSec: number;
	/** When the snapshot was measured. Playing keeps counting from here. */
	sampledAt?: string;
	/** Playing uses the bright filled-button color. Paused keeps the quiet fill. */
	playing: boolean;
}) {
	const livePositionSec = useCompanionPlayhead(
		positionSec,
		durationSec,
		sampledAt,
		playing,
	);
	const ratio = Math.min(1, Math.max(0, livePositionSec / durationSec));
	return (
		<div className="mt-2 flex min-w-0 items-center gap-2.5">
			<span
				className={cn(
					"shrink-0 text-xs tabular-nums",
					playing ? "text-foreground" : "text-muted-foreground",
				)}
			>
				{formatCompanionClock(livePositionSec)}
			</span>
			<div
				className="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(ratio * 100)}
				aria-label="Playback progress"
			>
				<div
					className={cn(
						"h-full rounded-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
						playing ? "bg-foreground" : "bg-foreground/55",
					)}
					style={{ width: `${ratio * 100}%` }}
				/>
			</div>
			<span className="shrink-0 text-muted-foreground/70 text-xs tabular-nums">
				{formatCompanionClock(durationSec)}
			</span>
		</div>
	);
}

/**
 * Companion row on the profile. Poster, Watching with Sense, the title,
 * then one line: the episode, or On the service for a film.
 */
function CompanionWatchingRow({
	activity,
	className,
}: ProfileDiscordActivityRowProps) {
	const imageUrl = activity.imageUrl?.trim() || null;
	const headline = discordActivityHeadline(activity);
	const paused =
		activity.paused === true || activity.detail?.trim() === "Paused";
	const status = companionStatusWord(activity);
	const statusRef = useTextStateSwap(status);
	const episodeLine = companionEpisodeLine(activity);
	const platformLine = companionPlatformLine(activity);
	const playback = activity.playback;
	const showPlayback =
		playback != null && playback.durationSec > 0 && playback.positionSec >= 0;
	const href = activity.href?.trim() || null;
	const accessibleName = [
		activity.label,
		episodeLine,
		platformLine,
		paused ? "paused" : null,
	]
		.filter((part): part is string => Boolean(part))
		.join(", ");
	const shellClassName = cn(
		"relative mx-auto mt-3 flex w-full max-w-md items-stretch gap-3 rounded-3xl bg-background p-3 text-left",
		"outline-none transition-transform duration-150 ease-out",
		"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
		"active:scale-[0.96]",
		className,
	);
	const inner = (
		<>
			{imageUrl ? (
				<span
					className={cn(
						"relative aspect-2/3 h-28 shrink-0 overflow-hidden rounded-xl",
						DISCORD_ACTIVITY_ART_OUTLINE_CLASSNAME,
					)}
				>
					<Image
						src={imageUrl}
						alt=""
						fill
						sizes="96px"
						className="object-cover"
						unoptimized
					/>
				</span>
			) : null}
			<span className="flex min-w-0 flex-1 flex-col justify-between self-stretch py-0.5">
				<span className="min-w-0">
					<span
						ref={statusRef}
						className="t-text-swap max-w-full truncate font-medium text-muted-foreground text-xs"
					>
						{status}
					</span>
					<span className="mt-0.5 block truncate font-semibold text-base text-foreground tracking-tight">
						{headline}
					</span>
					{episodeLine ? (
						<span className="mt-0.5 block truncate font-medium text-muted-foreground text-xs">
							{episodeLine}
						</span>
					) : null}
					{platformLine ? (
						<span className="mt-0.5 block truncate font-medium text-muted-foreground text-xs">
							{platformLine}
						</span>
					) : null}
				</span>
				{showPlayback && playback ? (
					<CompanionPlayback
						positionSec={playback.positionSec}
						durationSec={playback.durationSec}
						sampledAt={playback.sampledAt}
						playing={status === "Watching with Sense"}
					/>
				) : null}
			</span>
		</>
	);

	if (!href) {
		return <div className={shellClassName}>{inner}</div>;
	}

	return (
		<Link href={href} aria-label={accessibleName} className={shellClassName}>
			{inner}
		</Link>
	);
}

/**
 * Profile hero Discord activity — cover left, copy left, platform logo top-right when listening.
 */
export function ProfileDiscordActivityRow({
	activity,
	className,
}: ProfileDiscordActivityRowProps) {
	const softwareGpu = useSoftwareGpuRendering();
	if (activity.activitySource === "companion") {
		return <CompanionWatchingRow activity={activity} className={className} />;
	}
	const imageUrl = activity.imageUrl?.trim() || null;
	const coverAccent = activity.accentColor?.trim() || null;
	const headline = discordActivityHeadline(activity);
	const detail = activity.detail?.trim() || null;
	const listeningBrand = resolveDiscordListeningBrand(activity);
	const brandTheme = listeningBrand
		? discordListeningBrandTheme(listeningBrand)
		: null;
	const showProgress =
		activity.kind === "listening" && activity.progress != null;

	// Cover art drives ambient + progress; platform logo keeps brand color only.
	const ambientTintStyle = coverAccent
		? { backgroundColor: hexWithAlpha(coverAccent, softwareGpu ? 0.28 : 0.18) }
		: undefined;

	const kindLabel =
		activity.kind === "listening"
			? "Listening"
			: activity.kind === "playing"
				? "Playing"
				: activity.kind === "streaming"
					? "Streaming"
					: activity.kind === "watching"
						? "Watching"
						: "Activity";

	const shellClassName = cn(
		"relative mx-auto mt-3 w-full max-w-md overflow-hidden rounded-2xl bg-background",
		className,
	);

	const inner = (
		<>
			{imageUrl ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 overflow-hidden"
				>
					{softwareGpu ? (
						<div
							className="absolute inset-0 bg-card/85"
							style={ambientTintStyle}
						/>
					) : (
						<>
							<Image
								src={imageUrl}
								alt=""
								fill
								sizes="400px"
								className="scale-110 object-cover opacity-70 blur-2xl brightness-125"
								unoptimized
							/>
							<div
								className="absolute inset-0 bg-linear-to-b from-background/20 via-background/55 to-background/95"
								style={ambientTintStyle}
							/>
						</>
					)}
				</div>
			) : coverAccent ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0"
					style={ambientTintStyle}
				/>
			) : null}

			<div className="relative z-10 grid min-h-25 grid-cols-[auto_minmax(0,1fr)] items-stretch gap-3 p-3 sm:gap-3.5 sm:p-3.5">
				{imageUrl ? (
					<DiscordActivityArtwork
						imageUrl={imageUrl}
						headline={headline}
						albumName={activity.albumName}
						creatorName={activity.creatorName}
						creatorImageUrl={activity.creatorImageUrl}
					/>
				) : null}

				<div className="flex min-w-0 flex-col justify-between py-0.5">
					<div className="flex min-w-0 items-start justify-between gap-2">
						<p className="truncate font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
							{kindLabel}
						</p>
						{listeningBrand && brandTheme ? (
							<DiscordListeningBrandIcon
								brand={listeningBrand}
								className={cn("shrink-0", brandTheme.iconClassName)}
							/>
						) : null}
					</div>

					<div className="min-w-0 text-left">
						<p className="truncate font-semibold text-foreground text-sm tracking-tight sm:text-base">
							{headline}
						</p>
						{detail ? (
							<p className="truncate text-muted-foreground text-sm tracking-tight">
								{detail}
							</p>
						) : null}
					</div>

					{showProgress && activity.progress ? (
						<DiscordActivityProgressBar
							progress={activity.progress}
							fillColor={coverAccent}
							fillClassName={brandTheme?.progressFillClassName}
							className="mt-1.5"
						/>
					) : null}
				</div>
			</div>
		</>
	);

	return <div className={shellClassName}>{inner}</div>;
}
