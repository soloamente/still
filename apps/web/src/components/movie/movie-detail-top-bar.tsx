"use client";

import IconShareIn from "@still/ui/icons/share-in";
import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useLobbyNavigationOptional } from "@/components/lobby/lobby-navigation-provider";
import {
	DetailMotionButton,
	DetailMotionLink,
} from "@/components/movie/detail-motion-pressable";
import { useMovieDetailReturn } from "@/components/movie/use-movie-detail-return";
import { DetailViewSegmentToolbar } from "@/components/ui/detail-view-segment-toolbar";
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
 * Film/TV detail header — dynamic back pill, four tabs on the raised `bg-card` track
 * with a measured sliding pill (same chip language as `/home`), and share.
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
	const back = useMovieDetailReturn();
	const [isScrolled, setIsScrolled] = useState(false);
	const [shareCopied, setShareCopied] = useState(false);

	useEffect(() => {
		const onScroll = () => {
			setIsScrolled(window.scrollY > 2);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const pill = cn(
		"inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 font-medium text-sm transition-colors duration-200 ease-out",
		"bg-card text-foreground [@media(hover:hover)]:hover:bg-muted/35",
		"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
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
		<header
			className={cn(
				"sticky top-0 z-30 w-full overflow-visible bg-background",
				"after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-[clamp(7rem,42svh,18rem)] after:bg-[linear-gradient(180deg,var(--background)_0%,color-mix(in_oklab,var(--background)_92%,transparent)_14%,color-mix(in_oklab,var(--background)_68%,transparent)_38%,color-mix(in_oklab,var(--background)_32%,transparent)_68%,transparent_100%)] after:opacity-0 after:transition-opacity after:duration-300 after:ease-out after:content-[''] motion-reduce:after:transition-none",
				isScrolled && "after:opacity-100",
			)}
		>
			<div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-2.5 py-2 sm:px-3">
				<div className="flex min-w-0 justify-start">
					<DetailMotionLink
						href={back.href}
						className={cn(pill, pillIconOnlyMobile, "pl-3 max-sm:pl-0")}
						aria-label={back.label}
					>
						<IconShareIn size="20px" className="shrink-0 opacity-90" />
						<span className="hidden truncate sm:inline">{back.label}</span>
					</DetailMotionLink>
				</div>
				<DetailViewSegmentToolbar
					aria-label="Title detail"
					value={view}
					tabs={DETAIL_VIEW_TABS}
					renderTab={renderViewTab}
				/>
				<div className="flex min-w-0 items-center justify-end gap-2">
					<DetailMotionButton
						type="button"
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
