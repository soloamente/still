"use client";

import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import { DetailMotionButton } from "@/components/movie/detail-motion-pressable";
import { DetailViewSegmentToolbar } from "@/components/ui/detail-view-segment-toolbar";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import {
	buildMovieDetailViewHref,
	type MovieDetailListingKind,
	type MovieDetailView,
} from "@/lib/movie-detail-view";

const DETAIL_VIEW_TABS: readonly {
	id: MovieDetailView;
	label: string;
}[] = [
	{ id: "about", label: "About" },
	{ id: "streaming", label: "Streaming" },
	{ id: "community", label: "Community" },
	{ id: "quotes", label: "Quotes" },
];

/**
 * Film/TV view header inside the raised detail card — About / Streaming /
 * Community / Quotes, plus Share. The home lobby header sits above the card.
 * The left cell stays empty so the tabs stay centered; listing presence (who is
 * on this title) occupies that corner, so there is no back pill.
 */
export function MovieDetailTopBar({
	movieId,
	title,
	view,
	detailBasePath,
	listingKind = "movie",
	tvQuoteEpisode,
	onViewChange,
}: {
	movieId: number;
	title: string;
	view: MovieDetailView;
	detailBasePath?: string;
	listingKind?: MovieDetailListingKind;
	tvQuoteEpisode?: { season: number; episode: number } | null;
	onViewChange?: (view: MovieDetailView) => void;
}) {
	const basePath = detailBasePath ?? `/movies/${movieId}`;
	const lobbyNav = useLobbyNavigationOptional();

	const pathname = usePathname();
	const [shareCopied, setShareCopied] = useState(false);

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-background text-foreground",
		DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
	);
	const pillIconOnlyMobile =
		"max-sm:size-10 max-sm:justify-center max-sm:gap-0 max-sm:p-0";

	function buildViewHref(nextView: MovieDetailView) {
		return buildMovieDetailViewHref(basePath, nextView, {
			listingKind,
			season: tvQuoteEpisode?.season,
			episode: tvQuoteEpisode?.episode,
		});
	}

	async function handleShare() {
		const href =
			typeof window !== "undefined"
				? `${window.location.origin}${pathname}${window.location.search}`
				: `${basePath}${view === "about" ? "" : buildViewHref(view).slice(basePath.length)}`;

		try {
			await navigator.clipboard.writeText(href);
			setShareCopied(true);
			toast.success("Link copied");
			window.setTimeout(() => setShareCopied(false), 1600);
		} catch {
			toast.error("Couldn't copy link");
		}
	}

	function handleViewSelect(nextView: MovieDetailView) {
		onViewChange?.(nextView);
		if (lobbyNav) {
			lobbyNav.navigate(buildViewHref(nextView));
		}
	}

	function renderViewTab({
		id: tabView,
		label,
		active,
		className,
		"data-segment-id": dataSegmentId,
	}: {
		id: MovieDetailView;
		label: string;
		active: boolean;
		className: string;
		"data-segment-id": string;
	}) {
		if (lobbyNav) {
			return (
				<button
					type="button"
					data-segment-id={dataSegmentId}
					className={className}
					aria-current={active ? "page" : undefined}
					onClick={() => handleViewSelect(tabView)}
				>
					{label}
				</button>
			);
		}

		return (
			<Link
				href={buildViewHref(tabView)}
				data-segment-id={dataSegmentId}
				className={className}
				aria-current={active ? "page" : undefined}
			>
				{label}
			</Link>
		);
	}

	return (
		<header className="relative w-full">
			<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
				{/* Presence pill is absolutely positioned over this cell. */}
				<div className="min-w-0" />
				<DetailViewSegmentToolbar
					aria-label="Title detail"
					surface="card"
					value={view}
					tabs={DETAIL_VIEW_TABS}
					renderTab={renderViewTab}
				/>
				<div className="flex min-w-0 items-center justify-end gap-2">
					<DetailMotionButton
						type="button"
						motionVariant="chrome"
						className={cn(pill, pillIconOnlyMobile, "pr-3 max-sm:pr-0")}
						onClick={() => void handleShare()}
						aria-label={shareCopied ? "Link copied" : `Copy link for ${title}`}
						iconSwapKey={shareCopied ? "copied" : "share"}
					>
						<span className="hidden sm:inline">
							{shareCopied ? "Copied" : "Share"}
						</span>
						{shareCopied ? (
							<Check className="size-4 shrink-0 opacity-90" aria-hidden />
						) : (
							<IconShareOut size="20px" className="shrink-0 opacity-90" />
						)}
					</DetailMotionButton>
				</div>
			</div>
		</header>
	);
}
