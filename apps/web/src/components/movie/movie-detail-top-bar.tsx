"use client";

import IconShareIn from "@still/ui/icons/share-in";
import IconShareOut from "@still/ui/icons/share-out";
import { cn } from "@still/ui/lib/utils";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
 * with a sliding `layoutId` pill (same chip language as pre–Task 6 detail), and share.
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

	const reduceMotion = useReducedMotion();
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

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

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

	const segLink = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 shrink-0 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-4",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	function ViewTab({
		tabView,
		label,
	}: {
		tabView: MovieDetailView;
		label: string;
	}) {
		const active = view === tabView;
		const className = segLink(active);

		if (lobbyNav) {
			return (
				<button
					type="button"
					className={className}
					aria-current={active ? "page" : undefined}
					onClick={() => handleViewSelect(tabView)}
				>
					{active ? (
						<motion.span
							layoutId="movie-detail-view-pill"
							className="absolute inset-0 z-0 rounded-full bg-background"
							transition={pillTransition}
						/>
					) : null}
					<span className="relative z-10">{label}</span>
				</button>
			);
		}

		const href = buildViewHref(tabView);
		return (
			<Link
				href={href}
				className={className}
				aria-current={active ? "page" : undefined}
			>
				{active ? (
					<motion.span
						layoutId="movie-detail-view-pill"
						className="absolute inset-0 z-0 rounded-full bg-background"
						transition={pillTransition}
					/>
				) : null}
				<span className="relative z-10">{label}</span>
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
				<nav
					aria-label="Title detail"
					className="flex max-w-[min(100vw-7.5rem,22rem)] shrink-0 gap-1 overflow-x-auto rounded-full bg-card p-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:max-w-none [&::-webkit-scrollbar]:hidden"
				>
					{DETAIL_VIEW_TABS.map((tab) => (
						<ViewTab key={tab.id} tabView={tab.id} label={tab.label} />
					))}
				</nav>
				<div className="flex min-w-0 justify-end">
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
