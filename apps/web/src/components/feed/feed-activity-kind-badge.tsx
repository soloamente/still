import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import {
	Eye,
	ListMusic,
	type LucideIcon,
	PenLine,
	RotateCcw,
} from "lucide-react";

export type FeedActivityKind = "log" | "review" | "list";

type BadgeSpec = {
	label: string;
	icon: LucideIcon;
	tone: "neutral" | "accent" | "list";
};

const TONE_CLASS: Record<BadgeSpec["tone"], string> = {
	neutral: "bg-card text-foreground",
	accent: "bg-desert-orange/15 text-desert-orange",
	list: "bg-card text-foreground",
};

/** Inline verb copy for the activity byline (no pill chrome). */
export function FeedActivityVerb({
	kind,
	rewatch = false,
	className,
}: {
	kind: FeedActivityKind;
	rewatch?: boolean;
	className?: string;
}) {
	const label =
		kind === "review"
			? "Reviewed"
			: kind === "list"
				? "Updated a list"
				: rewatch
					? "Rewatched"
					: "Watched";

	return (
		<span className={cn("text-muted-foreground text-sm", className)}>
			{label}
		</span>
	);
}

/**
 * Scannable activity verb — pill variant for dense rails; activity feed uses
 * {@link FeedActivityVerb} in the byline instead.
 */
export function FeedActivityKindBadge({
	kind,
	rewatch = false,
}: {
	kind: FeedActivityKind;
	rewatch?: boolean;
}) {
	const spec: BadgeSpec =
		kind === "review"
			? { label: "Review", icon: PenLine, tone: "accent" }
			: kind === "list"
				? { label: "List", icon: ListMusic, tone: "list" }
				: rewatch
					? { label: "Rewatched", icon: RotateCcw, tone: "neutral" }
					: { label: "Watched", icon: Eye, tone: "neutral" };

	const Icon = spec.icon;

	return (
		<span
			className={cn(
				"inline-flex min-h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs leading-none",
				TONE_CLASS[spec.tone],
			)}
		>
			<Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
			{spec.label}
		</span>
	);
}

/** Heart on a watch log = title added to patron favorites (same as quick-log). */
export function FeedActivityFavoriteChip({
	className,
}: {
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex min-h-6 items-center gap-1.5 rounded-full bg-card py-1 pr-3 pl-2 font-medium text-desert-orange text-xs leading-none",
				className,
			)}
		>
			<IconHeartFilled className="size-3.5 shrink-0" aria-hidden />
			Favorite
		</span>
	);
}
