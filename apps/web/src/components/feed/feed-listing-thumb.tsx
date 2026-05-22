import { cn } from "@still/ui/lib/utils";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/** Compact tile for review cards; `activity` = uniform portrait on community feed rows. */
export type FeedListingThumbLayout = "compact" | "activity";

/** Subtle depth on poster art (light/dark outline per make-interfaces-feel-better). */
const POSTER_OUTLINE_CLASS =
	"outline outline-1 outline-black/10 dark:outline-white/10";

/**
 * Shared footprint for every activity row (watch, review, list) so covers never
 * vary with card height — film/TV posters and list covers use the same slot.
 */
export const ACTIVITY_POSTER_FRAME_CLASS = cn(
	"relative block aspect-2/3 w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-card",
	POSTER_OUTLINE_CLASS,
);

const ACTIVITY_PRESS_CLASS =
	"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100";

/**
 * Listing art for feed rows — `activity` uses {@link ACTIVITY_POSTER_FRAME_CLASS};
 * `compact` keeps a fixed w-14 tile for review cards.
 */
export function FeedListingThumb({
	title,
	posterUrl,
	href,
	listingKind = "movie",
	linkable = true,
	layout = "compact",
	className,
}: {
	title: string;
	posterUrl: string | null;
	href?: string;
	listingKind?: "movie" | "tv";
	linkable?: boolean;
	layout?: FeedListingThumbLayout;
	className?: string;
}) {
	const isActivity = layout === "activity";

	const inner = posterUrl ? (
		<Image
			src={posterUrl}
			alt={title}
			fill
			sizes={isActivity ? "88px" : "56px"}
			className="object-cover"
		/>
	) : (
		<div
			className="grid size-full place-items-center bg-soft-stone text-muted-foreground"
			aria-hidden
		>
			{listingKind === "tv" ? (
				<Tv className="size-5 opacity-70" />
			) : (
				<Film className="size-5 opacity-70" />
			)}
		</div>
	);

	if (isActivity) {
		const frameClassName = cn(ACTIVITY_POSTER_FRAME_CLASS, className);
		if (linkable && href) {
			return (
				<Link
					href={href}
					className={cn(frameClassName, ACTIVITY_PRESS_CLASS)}
					aria-label={title}
				>
					{inner}
				</Link>
			);
		}
		return <div className={frameClassName}>{inner}</div>;
	}

	const frameClassName = cn(
		"relative aspect-2/3 w-14 shrink-0 overflow-hidden rounded-xl bg-card",
		POSTER_OUTLINE_CLASS,
		className,
	);

	const frame = <div className={frameClassName}>{inner}</div>;
	const compactShell = cn("shrink-0", ACTIVITY_PRESS_CLASS);

	if (linkable && href) {
		return (
			<Link href={href} className={compactShell} aria-label={title}>
				{frame}
			</Link>
		);
	}

	return <div className={compactShell}>{frame}</div>;
}

/** List rows without cover art — identical dimensions to activity posters. */
export function FeedListPlaceholderFrame({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				ACTIVITY_POSTER_FRAME_CLASS,
				"grid place-items-center bg-soft-stone text-desert-orange",
				className,
			)}
			aria-hidden
		>
			{children}
		</div>
	);
}
